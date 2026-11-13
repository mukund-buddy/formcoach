// Pushup exercise — dual-counter engine
// Counter 1 (primary): elbow angle (shoulder-elbow-wrist, 3D)
// Counter 2 (backup): shoulder height oscillation (auto-calibrated) —
//   jab elbow readings unreliable ho (occlusion/dead zone), side-view motion se count
// Hip form: EMA-smoothed + sustained (12+ frames) — spam nahi hoga
import { angleDeg } from "../angles.js";

const DOWN_MAX = 125;        // elbow angle <= isse => neeche
const UP_MIN = 145;          // elbow angle >= isse => upar
const SAG_MIN = 150;         // hip angle < isse (sustained) => kamar jhuki
const VIS_MIN = 0.3;
const DEBOUNCE = 3;          // consecutive frames for phase switch
const DEAD_FRAMES = 50;      // ~2.5s half-pushup => coaching cue
const Y_WINDOW = 90;         // rolling shoulder-y window (~4-5s)
const Y_RANGE_MIN = 0.08;    // oscillation needed to auto-calibrate
const Y_MARGIN = 0.35;       // thresholds inside observed range
const REP_COOLDOWN_MS = 700; // ek rep ke baad gap (double-count guard)

export class PushupExercise {
  constructor() {
    this.phase = "up";
    this.transitionFrames = 0;
    this.reps = 0;
    this.emaElbow = null;
    this.emaHip = null;
    this.sagFrames = 0;
    this.deadFrames = 0;
    this.lastRepAt = 0;
    // shoulder-y backup machine
    this.yWindow = [];
    this.yPhase = "up";
    this.yTrans = 0;
    this.yRange = 0;
  }

  vis(l) { return l.visibility ?? 1; }

  update(lm, now = performance.now()) {
    // ---- elbow angle ----
    const elbowReadings = [];
    for (const [s, e, w] of [[11, 13, 15], [12, 14, 16]]) {
      if (this.vis(lm[s]) > VIS_MIN && this.vis(lm[e]) > VIS_MIN && this.vis(lm[w]) > VIS_MIN) {
        elbowReadings.push(angleDeg(lm[s], lm[e], lm[w]));
      }
    }
    let elbow = this.emaElbow;
    if (elbowReadings.length) {
      const reading = Math.min(...elbowReadings);
      elbow = elbow == null ? reading : elbow * 0.6 + reading * 0.4;
      this.emaElbow = elbow;
    }

    // ---- hip form (EMA + sustain) ----
    const hipReadings = [];
    for (const [s, h, k] of [[11, 23, 25], [12, 24, 26]]) {
      if (this.vis(lm[s]) > VIS_MIN && this.vis(lm[h]) > VIS_MIN && this.vis(lm[k]) > VIS_MIN) {
        hipReadings.push(angleDeg(lm[s], lm[h], lm[k]));
      }
    }
    if (hipReadings.length) {
      const h = Math.max(...hipReadings);
      this.emaHip = this.emaHip == null ? h : this.emaHip * 0.8 + h * 0.2;
    }
    let formPct = 100;
    let cue = null;
    this.sagFrames = this.emaHip != null && this.emaHip < SAG_MIN ? this.sagFrames + 1 : 0;
    if (this.sagFrames > 12) {
      formPct -= 35;
      cue = "Kamar seedhi rakho";
    }

    // ---- counter 1: elbow state machine (debounced) ----
    let elbowRep = false;
    if (elbow != null) {
      if (this.phase === "up") {
        if (elbow < DOWN_MAX) {
          if (++this.transitionFrames >= DEBOUNCE) {
            this.phase = "down";
            this.transitionFrames = 0;
            this.deadFrames = 0;
          }
        } else {
          this.transitionFrames = 0;
          if (elbow < UP_MIN) {
            if (++this.deadFrames >= DEAD_FRAMES) {
              this.deadFrames = 0;
              cue = cue ?? "Aur neeche jao, kohni mudo";
            }
          }
        }
      } else {
        if (elbow > UP_MIN) {
          if (++this.transitionFrames >= DEBOUNCE) {
            this.phase = "up";
            this.transitionFrames = 0;
            elbowRep = true;
          }
        } else {
          this.transitionFrames = 0;
        }
      }
    }

    // ---- counter 2: shoulder-y oscillation (backup) ----
    const shY = (lm[11].y + lm[12].y) / 2;
    this.yWindow.push(shY);
    if (this.yWindow.length > Y_WINDOW) this.yWindow.shift();
    let yRep = false;
    if (this.yWindow.length >= 30) {
      const mn = Math.min(...this.yWindow);
      const mx = Math.max(...this.yWindow);
      this.yRange = mx - mn;
      if (this.yRange >= Y_RANGE_MIN) {
        // image y neeche badhta hai: up position = chhota y, down = bada y
        if (this.yPhase === "up") {
          if (shY > mx - this.yRange * Y_MARGIN) {
            if (++this.yTrans >= DEBOUNCE) { this.yPhase = "down"; this.yTrans = 0; }
          } else this.yTrans = 0;
        } else {
          if (shY < mn + this.yRange * Y_MARGIN) {
            if (++this.yTrans >= DEBOUNCE) { this.yPhase = "up"; this.yTrans = 0; yRep = true; }
          } else this.yTrans = 0;
        }
      }
    }

    // backup sirf tab jab elbow unreliable ho (occluded ya dead zone mein)
    const elbowUsable = elbowReadings.length > 0;
    const elbowMid = elbowUsable && elbow >= DOWN_MAX && elbow <= UP_MIN;
    const backupGate = !elbowUsable || elbowMid;

    // ---- merge with cooldown ----
    let repped = false;
    if ((elbowRep || (yRep && backupGate)) && now - this.lastRepAt >= REP_COOLDOWN_MS) {
      this.reps += 1;
      this.lastRepAt = now;
      repped = true;
    }

    return {
      repped,
      cue,
      formPct: Math.max(0, formPct),
      raw: {
        armVisible: elbowUsable,
        elbow: elbow != null ? Math.round(elbow) : null,
        hip: this.emaHip != null ? Math.round(this.emaHip) : null,
        phase: this.phase,
        yRange: Math.round(this.yRange * 100),
        counter: backupGate ? "y-motion" : "elbow",
      },
    };
  }
}
