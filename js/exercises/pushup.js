// Pushup exercise — elbow angle state machine
// Landmark indices (MediaPipe Pose): 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips
import { angleDeg } from "../angles.js";

const DOWN_MAX = 118;    // kohni angle <= isse => "neeche" position
const UP_MIN = 148;      // kohni angle >= isse => "upar" (seedhe haath)
const DEAD_LOW = 118;    // dead zone: na poora neeche na poora upar
const SAG_MIN = 150;     // shoulder-hip-knee < isse => kamar jhuki
const VIS_MIN = 0.4;     // landmark visibility cutoff
const DEBOUNCE = 3;      // kitne consecutive frames phase switch ke liye
const DEAD_FRAMES = 50;  // ~2.5s dead zone ke baad "aur neeche jao"

export class PushupExercise {
  constructor() {
    this.phase = "up";          // "up" | "down"
    this.transitionFrames = 0;
    this.reps = 0;
    this.emaElbow = null;       // smoothing
    this.deadFrames = 0;
  }

  vis(l) { return l.visibility ?? 1; }

  update(lm) {
    // kohna angle — sirf visible arms se, dono mein se jo zyada seedha wo
    const elbowReadings = [];
    for (const [s, e, w] of [[11, 13, 15], [12, 14, 16]]) {
      if (this.vis(lm[s]) > VIS_MIN && this.vis(lm[e]) > VIS_MIN && this.vis(lm[w]) > VIS_MIN) {
        elbowReadings.push(angleDeg(lm[s], lm[e], lm[w]));
      }
    }
    let elbow = this.emaElbow;
    if (elbowReadings.length) {
      const reading = Math.min(...elbowReadings); // jo arm behtar dikh raha hai
      elbow = elbow == null ? reading : elbow * 0.6 + reading * 0.4;
      this.emaElbow = elbow;
    }

    // kamar (hip) form — shoulder-hip-knee angle at hip
    const hipReadings = [];
    for (const [s, h, k] of [[11, 23, 25], [12, 24, 26]]) {
      if (this.vis(lm[s]) > VIS_MIN && this.vis(lm[h]) > VIS_MIN && this.vis(lm[k]) > VIS_MIN) {
        hipReadings.push(angleDeg(lm[s], lm[h], lm[k]));
      }
    }
    const hipStraight = hipReadings.length ? Math.max(...hipReadings) : 180;

    let repped = false;
    let cue = null;

    // state machine (debounced — flicker se fake reps nahi)
    if (elbow != null) {
      if (this.phase === "up") {
        if (elbow < DOWN_MAX) {
          this.transitionFrames++;
          if (this.transitionFrames >= DEBOUNCE) {
            this.phase = "down";
            this.transitionFrames = 0;
            this.deadFrames = 0;
          }
        } else {
          this.transitionFrames = 0;
          // dead zone: half pushup — coaching cue
          if (elbow < UP_MIN) {
            this.deadFrames++;
            if (this.deadFrames >= DEAD_FRAMES) {
              this.deadFrames = 0;
              cue = "Aur neeche jao, kohni mudo";
            }
          }
        }
      } else {
        if (elbow > UP_MIN) {
          this.transitionFrames++;
          if (this.transitionFrames >= DEBOUNCE) {
            this.phase = "up";
            this.transitionFrames = 0;
            this.deadFrames = 0;
            this.reps += 1;
            repped = true;
          }
        } else {
          this.transitionFrames = 0;
        }
      }
    }

    // form: kamar seedhi
    let formPct = 100;
    if (hipReadings.length && hipStraight < SAG_MIN) {
      formPct -= 35;
      cue = cue ?? "Kamar seedhi rakho";
    }

    return {
      repped,
      cue,
      formPct: Math.max(0, formPct),
      raw: {
        armVisible: elbowReadings.length > 0,
        elbow: elbow != null ? Math.round(elbow) : null,
        hip: Math.round(hipStraight),
        phase: this.phase,
      },
    };
  }
}
