// FormCoach — main app module
// Camera + MediaPipe Pose Landmarker (on-device) + goal/pause/cue system

import { Storage } from "./storage.js";
import { Voice } from "./voice.js";
import { License } from "./license.js";
import { PushupExercise } from "./exercises/pushup.js";
import { SuryaExercise } from "./exercises/surya.js";

// ---------- DOM ----------
const screens = {
  home: document.getElementById("home"),
  goal: document.getElementById("goal-picker"),
  camera: document.getElementById("camera-stage"),
  unlock: document.getElementById("unlock-screen"),
  summary: document.getElementById("summary-screen"),
};
const els = {
  video: document.getElementById("camera-feed"),
  canvas: document.getElementById("skeleton-overlay"),
  repCount: document.getElementById("rep-count"),
  formScore: document.getElementById("form-score"),
  goalPill: document.getElementById("goal-pill"),
  error: document.getElementById("error-msg"),
  licenseStatus: document.getElementById("license-status"),
  deviceCode: document.getElementById("device-code"),
  keyInput: document.getElementById("license-key-input"),
  activateMsg: document.getElementById("activate-msg"),
  summaryStats: document.getElementById("summary-stats"),
  summaryTitle: document.getElementById("summary-title"),
  btnUnlock: document.getElementById("btn-unlock"),
  loading: document.getElementById("loading-overlay"),
  loadMsg: document.getElementById("load-msg"),
  loadRetry: document.getElementById("load-retry"),
  cueBanner: document.getElementById("cue-banner"),
  statusChip: document.getElementById("status-chip"),
  btnPause: document.getElementById("btn-pause"),
  btnFlip: document.getElementById("btn-flip"),
  debugChip: document.getElementById("debug-chip"),
  goalTitle: document.getElementById("goal-title"),
  goalChips: document.getElementById("goal-chips"),
};

function show(name) {
  for (const k in screens) screens[k].classList.toggle("hidden", k !== name);
  els.btnUnlock.classList.toggle("hidden", License.isUnlocked());
  els.licenseStatus.textContent = License.isUnlocked() ? "Full" : "Free";
  els.licenseStatus.classList.toggle("paid", License.isUnlocked());
}

function showHome() { show("home"); }

// ---------- Exercise registry + goals ----------
const EXERCISES = {
  pushup: PushupExercise,
  surya: SuryaExercise,
};
const GOALS = {
  pushup: [10, 20, 30, null],
  surya: [3, 5, 10, null],
};
const EX_LABEL = { pushup: "Pushups", surya: "Surya Namaskar" };

// ---------- MediaPipe ----------
const MP_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let poseLandmarker = null;
let currentExercise = null;
let session = null;
let rafId = null;
let lastVideoTime = -1;
let lastCueAt = 0;
let missFrames = 0;
let paused = false;
let facing = "user"; // "user" = front, "environment" = back

async function initPose() {
  els.loading.classList.remove("done");
  els.loadMsg.textContent = "AI coach load ho raha hai... (pehli baar ~6MB)";
  els.loadRetry.classList.add("hidden");
  try {
    const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    els.loading.classList.add("done");
  } catch (err) {
    els.loadMsg.textContent = `Load fail: ${err.message}. Internet check karo, fir retry.`;
    els.loadRetry.classList.remove("hidden");
    throw err;
  }
}

async function startCamera(mode = facing) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  els.video.srcObject = stream;
  // race fix: metadata pehle se aa chuka ho to wait mat karo
  if (els.video.readyState < 1) {
    await new Promise((resolve) => {
      els.video.onloadedmetadata = () => resolve();
      setTimeout(resolve, 4000); // safety
    });
  }
  await els.video.play().catch(() => {});
}

function stopCamera() {
  const stream = els.video.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  els.video.srcObject = null;
}

// ---------- Render loop ----------
function loop() {
  rafId = requestAnimationFrame(loop);
  const video = els.video;
  if (!session || paused) return;
  if (!video.videoWidth || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  let result;
  try {
    result = poseLandmarker.detectForVideo(video, performance.now());
  } catch {
    return;
  }
  drawFrame(result);
  evaluatePose(result);
}

function drawFrame(result) {
  const canvas = els.canvas;
  const video = els.video;
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const lm = result.landmarks?.[0];
  if (!lm) return;

  const pairs = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
    [24, 26], [26, 28], [27, 31], [28, 32],
  ];
  ctx.strokeStyle = "rgba(255,159,28,0.9)";
  ctx.lineWidth = 3;
  for (const [a, b] of pairs) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
    ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
    ctx.stroke();
  }
  ctx.fillStyle = "#2ec4b6";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function evaluatePose(result) {
  const lm = result.landmarks?.[0];
  if (!lm || !currentExercise || !session) return;

  // pose detect ho raha hai ya nahi — user ko pata ho
  const visible = lm[0] && lm[11] && lm[23] &&
    (lm[0].visibility ?? 1) > 0.5 && (lm[11].visibility ?? 1) > 0.5;
  if (!visible) {
    missFrames++;
    if (missFrames > 20) {
      els.statusChip.textContent = "Body dikh nahi raha — camera ke saamne aao";
      els.statusChip.classList.remove("hidden");
    }
  } else {
    missFrames = 0;
    els.statusChip.classList.add("hidden");
  }

  const state = currentExercise.update(lm);
  els.repCount.textContent = String(session.reps);
  els.formScore.textContent =
    state.formPct != null ? `${Math.round(state.formPct)}%` : "--";
  if (state.formPct != null) session.formSamples.push(state.formPct);

  // debug chip — live values (user accuracy report kar sake)
  if (state.raw) {
    let dbg = "";
    if (state.raw.elbow != null) {
      dbg = `kohna ${state.raw.elbow}° | kamar ${state.raw.hip}° | ${state.raw.phase}`;
    } else if (state.raw.step != null) {
      dbg = state.raw.hit ? "pose sahi — hold karo" : "target pose banao";
    }
    if (dbg) {
      els.debugChip.textContent = dbg;
      els.debugChip.classList.remove("hidden");
    }
  }
  // haath frame mein nahi (pushup)
  if (state.raw && state.raw.armVisible === false) {
    els.statusChip.textContent = "Haath dikh nahi rahe — poora body frame mein rakho";
    els.statusChip.classList.remove("hidden");
  }

  // guided instruction (Surya) — persistent banner
  if (state.cueHold) {
    els.cueBanner.textContent = state.cueHold;
    els.cueBanner.classList.remove("hidden");
    if (state.stepChanged && state.voiceLine) Voice.say(state.voiceLine);
  }

  const now = performance.now();
  if (state.cue && now - lastCueAt > 2500) {
    lastCueAt = now;
    els.cueBanner.textContent = state.cue;
    els.cueBanner.classList.remove("hidden");
    setTimeout(() => {
      if (els.cueBanner.textContent === state.cue) els.cueBanner.classList.add("hidden");
    }, 2200);
    Voice.say(state.cue);
  }

  // goal check
  if (session.goal != null && session.reps >= session.goal) {
    Voice.say("Goal complete! Shabash!");
    endSession(true);
  }
}

function updateHud() {
  if (!session) return;
  els.goalPill.textContent =
    session.goal != null ? `${session.reps} / ${session.goal}` : "Khula — ginte raho";
  els.repCount.textContent = String(session.reps);
}

// ---------- Session flow ----------
let pendingExercise = null;

function openGoalPicker(exerciseId) {
  pendingExercise = exerciseId;
  els.goalTitle.textContent = `${EX_LABEL[exerciseId]} — Target chuno`;
  els.goalChips.innerHTML = "";
  for (const g of GOALS[exerciseId]) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent =
      g == null ? "Khula (goal nahi)" : `${g} ${exerciseId === "surya" ? "round" : "reps"}`;
    btn.addEventListener("click", () => startSession(exerciseId, g));
    els.goalChips.appendChild(btn);
  }
  show("goal");
}
document.getElementById("goal-back").addEventListener("click", showHome);

async function startSession(exerciseId, goal) {
  paused = false;
  els.btnPause.textContent = "Pause";
  els.btnPause.classList.remove("paused");
  els.repCount.textContent = "0";
  els.statusChip.classList.add("hidden");
  els.cueBanner.classList.add("hidden");
  try {
    els.error.classList.add("hidden");
    show("camera");
    els.loading.classList.remove("done");
    els.loadMsg.textContent = "AI coach load ho raha hai... (pehli baar ~6MB)";
    if (!poseLandmarker) await initPose();
    await startCamera();
    currentExercise = new EXERCISES[exerciseId]();
    session = { exercise: exerciseId, goal, reps: 0, formSamples: [], startedAt: Date.now() };
    lastVideoTime = -1;
    missFrames = 0;
    updateHud();
    els.loading.classList.add("done");
    cancelAnimationFrame(rafId);
    loop();
    Voice.say(`Shuru karo! Target ${goal ?? "khula"}`);
  } catch (err) {
    els.loadMsg.textContent = `Error: ${err.message || err}`;
    els.loadRetry.classList.remove("hidden");
    els.loading.classList.remove("done");
  }
}
document.getElementById("load-retry").addEventListener("click", () => location.reload());

// camera screen controls
document.getElementById("cam-exit").addEventListener("click", () => {
  if (session) endSession(false); else showHome();
});
els.btnPause.addEventListener("click", () => {
  if (!session) return;
  paused = !paused;
  els.btnPause.textContent = paused ? "Resume" : "Pause";
  els.btnPause.classList.toggle("paused", paused);
  if (paused) Voice.say("Pause");
});

// camera flip — front ⇄ back
els.btnFlip.addEventListener("click", async () => {
  if (!session) return;
  const next = facing === "user" ? "environment" : "user";
  try {
    stopCamera();
    await startCamera(next);
    facing = next;
  } catch {
    try { await startCamera(facing); } catch { /* purana stream gaya */ }
  }
});
document.getElementById("btn-end").addEventListener("click", () => endSession(false));

function endSession(achieved) {
  cancelAnimationFrame(rafId);
  paused = false;
  stopCamera();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (session) {
    const avgForm = session.formSamples.length
      ? Math.round(session.formSamples.reduce((a, b) => a + b, 0) / session.formSamples.length)
      : null;
    Storage.saveSession({ ...session, avgForm, achieved, endedAt: Date.now() });
    els.summaryTitle.textContent = achieved ? "GOAL COMPLETE! Shabash!" : "Session khatam!";
    els.summaryTitle.classList.toggle("win", achieved);
    const mins = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));
    els.summaryStats.innerHTML = `
      <div class="row"><span>Exercise</span><b>${EX_LABEL[session.exercise]}</b></div>
      <div class="row"><span>Reps</span><b>${session.reps}</b></div>
      <div class="row"><span>Goal</span><b>${session.goal ?? "Khula"}</b></div>
      <div class="row"><span>Form</span><b>${avgForm != null ? avgForm + "%" : "--"}</b></div>
      <div class="row"><span>Time</span><b>${mins} min</b></div>`;
    show("summary");
  }
  currentExercise = null;
  session = null;
}
document.getElementById("summary-home").addEventListener("click", showHome);

// ---------- Unlock + data controls ----------
document.getElementById("btn-unlock").addEventListener("click", () => {
  License.getDeviceCode().then((c) => {
    els.deviceCode.textContent = c;
    show("unlock");
  });
});
document.getElementById("unlock-back").addEventListener("click", showHome);
document.getElementById("activate-btn").addEventListener("click", async () => {
  const msg = els.activateMsg;
  msg.className = "";
  const ok = await License.activate(els.keyInput.value.trim());
  msg.textContent = ok ? "Activated! Full version unlocked." : "Key invalid ya doosre device ki hai.";
  msg.classList.add(ok ? "ok" : "err");
  if (ok) showHome();
});

document.getElementById("btn-export").addEventListener("click", async () => {
  const csv = await Storage.exportCSV();
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `formcoach-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById("btn-delete").addEventListener("click", async () => {
  const sure = confirm(
    "Saara data (sessions, streaks, unlock state) is device se delete ho jayega.\n" +
      "Hum iska koi backup nahi rakhte — ye wapas nahi aayega. Pakka?"
  );
  if (!sure) return;
  await Storage.deleteAll();
  License._unlocked = false;
  els.licenseStatus.textContent = "Free";
  els.licenseStatus.classList.remove("paid");
});

// ---------- Wiring: home cards ----------
document.querySelectorAll(".ex-card:not(.locked)").forEach((btn) =>
  btn.addEventListener("click", () => openGoalPicker(btn.dataset.exercise))
);

// init — license init fail ho to bhi home dikhe (blank screen kabhi nahi)
License.init().catch(() => {}).finally(() => {
  try { showHome(); } catch (e) { console.error("UI init fail:", e); }
});
