// Surya Namaskar — 12-pose GUIDED sequence state machine
// Har step ka number + instruction screen pe dikhta hai (user ko poses nahi aate,
// isliye app khud sikhata hai). Round = 12 poses poore.
//
// Signals front aur side dono view se kaam karne ki koshish karte hain,
// side view sabse accurate hai (goal screen pe tip diya hai).
import { angleDeg, midpoint } from "../angles.js";
import { t, poseInstructions } from "../i18n.js";

// Landmark indices: 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists,
// 23/24 hips, 25/26 knees, 27/28 ankles
export class SuryaExercise {
  constructor() {
    this.step = 0;           // 0..11 current expected pose
    this.stepHoldFrames = 0;
    this.reps = 0;           // completed rounds
    this.holdNeeded = 5;     // ~0.3s hold
  }

  update(lm) {
    const signals = poseSignals(lm);
    const targetIdx = this.step % 12;
    const hit = signals[targetIdx];
    let stepChanged = false;

    let repped = false;
    let cueKey = null;   // transient (round complete etc.)
    let cueVars = null;
    let formPct = null;

    if (hit) {
      this.stepHoldFrames++;
      if (this.stepHoldFrames >= this.holdNeeded) {
        this.stepHoldFrames = 0;
        this.step++;
        stepChanged = true;
        if (this.step % 12 === 0) {
          this.reps += 1;
          repped = true;
          cueKey = "round_done";
          cueVars = { n: this.reps };
        }
      }
    } else {
      this.stepHoldFrames = Math.max(0, this.stepHoldFrames - 2);
    }

    const next = this.step % 12;
    const instr = poseInstructions()[next];
    return {
      repped,
      cueKey,
      cueVars,
      // persistent instruction — app hamesha ye dikhata hai
      cueHold: `${t("pose_word")} ${next + 1}/12: ${instr}`,
      voiceLine: instr,
      stepChanged,
      formPct,
      raw: { step: next, hit, holdFrames: this.stepHoldFrames },
    };
  }
}

export const POSE_NAMES = [
  "Pranamasana", "Hasta Uttanasana", "Padahastasana", "Ashwa Sanchalanasana",
  "Dandasana", "Ashtanga Namaskara", "Bhujangasana", "Adho Mukha Svanasana",
  "Ashwa Sanchalanasana (ulti)", "Padahastasana", "Hasta Uttanasana", "Pranamasana",
];

// Har pose ka detect — true jab pose "hit" ho
function poseSignals(lm) {
  const nose = lm[0];
  const sh = midpoint(lm[11], lm[12]);   // shoulder center
  const hp = midpoint(lm[23], lm[24]);   // hip center
  const kn = midpoint(lm[25], lm[26]);   // knee center
  const an = midpoint(lm[27], lm[28]);   // ankle center
  const wr = midpoint(lm[15], lm[16]);   // wrist center

  const vis = (l) => l.visibility ?? 1;
  const ok = vis(lm[11]) > 0.4 && vis(lm[23]) > 0.4;
  if (!ok) return new Array(12).fill(false);

  const armUp = wr.y < nose.y || wr.y < sh.y - 0.10;        // haath sar ke upar
  const handsDown = wr.y > hp.y;                             // haath hip se neeche
  const upright = nose.y < hp.y;                             // khada hua body
  const torsoAngle = angleDeg(sh, hp, kn);                   // hip pe angle: khada ~180
  const namaste =
    wr.y > sh.y && wr.y < hp.y && Math.abs(wr.x - sh.x) < 0.10 && upright;
  const folded = torsoAngle < 132 && handsDown;              // aage jhuka
  const lunge =
    handsDown && Math.abs(lm[25].y - lm[26].y) > 0.06;       // ek ghutna zameen ke paas
  const armStraight = (() => {
    const a1 = angleDeg(lm[11], lm[13], lm[15]);
    const a2 = angleDeg(lm[12], lm[14], lm[16]);
    return Math.max(a1, a2) > 150;
  })();
  const plank = handsDown && armStraight && torsoAngle > 140 && Math.abs(sh.y - hp.y) < 0.12;
  const ashtanga = handsDown && kn.y > hp.y && Math.abs(sh.y - kn.y) < 0.18; // ghutne zameen
  const cobra =
    handsDown && Math.abs(hp.y - an.y) < 0.10 && nose.y < sh.y; // hips floor pe, seena upar
  const downDog = hp.y < sh.y - 0.05 && handsDown;           // kamar sabse upar

  return [
    /* 0  pranamasana */   namaste,
    /* 1  hasta utt */     armUp,
    /* 2  padahastasana */ folded,
    /* 3  ashwa san */     lunge,
    /* 4  dandasana */     plank,
    /* 5  ashtanga */      ashtanga,
    /* 6  bhujangasana */  cobra,
    /* 7  adho mukha */    downDog,
    /* 8  ashwa (ulti) */  lunge,
    /* 9  padahastasana */ folded,
    /* 10 hasta utt */     armUp,
    /* 11 pranamasana */   namaste,
  ];
}
