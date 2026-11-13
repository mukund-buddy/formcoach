// FormCoach — app logic (glass UI, tabbed mobile IA, 3 languages)
// Camera + MediaPipe Pose Landmarker (on-device) + goal/pause/cue system
// Flow: ex-card -> prep (start | tutorial) -> tutorial (video+steps) -> goal -> camera -> summary

import { Storage } from "./storage.js";
import { Voice } from "./voice.js";
import { License } from "./license.js";
import { PushupExercise } from "./exercises/pushup.js";
import { SuryaExercise } from "./exercises/surya.js";
import { initLang, setLang, lang, t, tpl, dateLocale, tutSteps } from "./i18n.js";

// ---------- DOM ----------
const TABS = { home: "tab-home", history: "tab-history", settings: "tab-settings" };
const FLOWS = { prep: "flow-prep", tutorial: "flow-tutorial", goal: "flow-goal", camera: "flow-camera", summary: "flow-summary" };
const ALL_SECTIONS = [...Object.values(TABS), ...Object.values(FLOWS)];
const navEl = document.querySelector(".bottom-nav");
const els = {
  video: document.getElementById("camera-feed"),
  canvas: document.getElementById("skeleton-overlay"),
  repCount: document.getElementById("rep-count"),
  formScore: document.getElementById("form-score"),
  goalPill: document.getElementById("goal-pill"),
  error: document.getElementById("error-msg"),
  statusPill: document.getElementById("status-pill"),
  deviceCode: document.getElementById("device-code"),
  keyInput: document.getElementById("license-key-input"),
  activateMsg: document.getElementById("activate-msg"),
  licenseLine: document.getElementById("license-line"),
  summaryStats: document.getElementById("summary-stats"),
  summaryTitle: document.getElementById("summary-title"),
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
  statStreak: document.getElementById("stat-streak"),
  statToday: document.getElementById("stat-today"),
  statSessions: document.getElementById("stat-sessions"),
  historyList: document.getElementById("history-list"),
  prepTitle: document.getElementById("prep-title"),
  tutTitle: document.getElementById("tut-title"),
  tutVideo: document.getElementById("tut-video"),
  tutSteps: document.getElementById("tut-steps"),
};

function show(name) {
  for (const id of ALL_SECTIONS) document.getElementById(id).classList.toggle("hidden", id !== name);
  const isFlow = Object.values(FLOWS).includes(name);
  navEl.classList.toggle("hidden", isFlow);
  if (!isFlow) {
    for (const btn of navEl.querySelectorAll(".nav-btn")) {
      btn.classList.toggle("active", TABS[btn.dataset.tab] === name);
    }
  }
  if (name !== FLOWS.tutorial) els.tutVideo.pause();
  refreshLicenseUI();
}

function showTab(tab) { show(TABS[tab]); }
function showHome() { renderDash(); showTab("home"); }
function showHistory() { renderHistory(); showTab("history"); }

for (const btn of navEl.querySelectorAll(".nav-btn")) {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab === "home") showHome();
    else if (tab === "history") showHistory();
    else showTab("settings");
  });
}
els.statusPill.addEventListener("click", () => showTab("settings"));

// ---------- i18n ----------
function applyLang() {
  document.documentElement.lang = lang === "english" ? "en" : "hi";
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll(".lang-chip").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  renderDash();
  renderHistory();
  if (!document.getElementById(FLOWS.goal).classList.contains("hidden") && pendingExercise) {
    openGoalPicker(pendingExercise, true);
  }
  if (!document.getElementById(FLOWS.tutorial).classList.contains("hidden") && pendingExercise) {
    openTutorial(pendingExercise, true);
  }
}

for (const chip of document.querySelectorAll(".lang-chip")) {
  chip.addEventListener("click", async () => {
    setLang(chip.dataset.lang);
    await Storage.kvSet("lang", chip.dataset.lang).catch(() => {});
    applyLang();
    showTab("settings");
  });
}

// ---------- Exercise registry + goals ----------
const EXERCISES = { pushup: PushupExercise, surya: SuryaExercise };
const GOALS = { pushup: [10, 20, 30, null], surya: [3, 5, 10, null] };
const exLabel = (id) => t(`ex_${id}_name`);

// ---------- Dashboard + history ----------
function dayKey(ts) { return new Date(ts).toISOString().slice(0, 10); }

async function renderDash() {
  try {
    const sessions = await Storage.getSessions();
    els.statSessions.textContent = String(sessions.length);
    const today = new Date().toISOString().slice(0, 10);
    els.statToday.textContent = String(
      sessions.filter((s) => dayKey(s.startedAt) === today).reduce((a, s) => a + s.reps, 0)
    );
    // streak: aaj ya kal se peeche consecutive days jisme >=1 session
    const days = new Set(sessions.map((s) => dayKey(s.startedAt)));
    let streak = 0;
    const d = new Date();
    if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1); // kal se shuru
    while (days.has(dayKey(d.getTime()))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    els.statStreak.textContent = String(streak);
  } catch {
    /* storage fail — stats 0 reh jayenge */
  }
}

async function renderHistory() {
  try {
    const sessions = await Storage.getSessions();
    sessions.sort((a, b) => b.startedAt - a.startedAt);
    if (!sessions.length) {
      els.historyList.innerHTML = `<div class="hist-empty">${t("hist_empty")}</div>`;
      return;
    }
    const loc = dateLocale();
    els.historyList.innerHTML = sessions
      .slice(0, 30)
      .map((s) => {
        const d = new Date(s.startedAt);
        const label = EXERCISES[s.exercise] ? exLabel(s.exercise) : s.exercise;
        const form = s.avgForm != null ? ` · ${Math.round(s.avgForm)}% ${t("row_form").toLowerCase()}` : "";
        const goal = s.goal != null ? tpl("hist_goal", { n: s.goal }) : t("hist_open");
        return `<div class="hist-row">
          <div class="hist-info"><b>${label}</b><span>${d.toLocaleDateString(loc)} · ${d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}${form}</span></div>
          <div class="hist-nums"><b>${s.reps}</b><span>${goal}</span></div>
        </div>`;
      })
      .join("");
  } catch {
    els.historyList.innerHTML = `<div class="hist-empty">${t("hist_err")}</div>`;
  }
}

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
  els.loadMsg.textContent = t("load_msg");
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
    els.loadMsg.textContent = tpl("load_fail", { m: err.message });
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
  if (els.video.readyState < 1) {
    await new Promise((resolve) => {
      els.video.onloadedmetadata = () => resolve();
      setTimeout(resolve, 4000);
    });
  }
  await els.video.play().catch(() => {});
}

function stopCamera() {
  const stream = els.video.srcObject;
  if (stream) stream.getTracks().forEach((tr) => tr.stop());
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
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  for (const [a, b] of pairs) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
    ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
    ctx.stroke();
  }
  ctx.fillStyle = "#7c5cfc";
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function evaluatePose(result) {
  const lm = result.landmarks?.[0];
  if (!lm || !currentExercise || !session) return;

  const visible = lm[0] && lm[11] && lm[23] &&
    (lm[0].visibility ?? 1) > 0.5 && (lm[11].visibility ?? 1) > 0.5;
  if (!visible) {
    missFrames++;
    if (missFrames > 20) {
      els.statusChip.textContent = t("st_body");
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

  if (state.raw) {
    let dbg = "";
    if (state.raw.elbow != null) {
      dbg = `${t("dbg_koh")} ${state.raw.elbow}° | ${t("dbg_kam")} ${state.raw.hip}° | ${state.raw.phase} | ${state.raw.counter}`;
    } else if (state.raw.step != null) {
      dbg = state.raw.hit ? t("dbg_hit") : t("dbg_miss");
    }
    if (dbg) {
      els.debugChip.textContent = dbg;
      els.debugChip.classList.remove("hidden");
    }
  }
  if (state.raw && state.raw.armVisible === false) {
    els.statusChip.textContent = t("st_arms");
    els.statusChip.classList.remove("hidden");
  }

  const cueText = state.cueKey
    ? tpl(state.cueKey, state.cueVars)
    : (state.cue ? t(state.cue) : null);

  if (state.cueHold) {
    els.cueBanner.textContent = state.cueHold;
    els.cueBanner.classList.remove("hidden");
    if (state.stepChanged && state.voiceLine) Voice.say(state.voiceLine);
  }

  const now = performance.now();
  if (cueText && now - lastCueAt > 2500) {
    lastCueAt = now;
    els.cueBanner.textContent = cueText;
    els.cueBanner.classList.remove("hidden");
    setTimeout(() => {
      if (els.cueBanner.textContent === cueText) els.cueBanner.classList.add("hidden");
    }, 2200);
    Voice.say(cueText);
  }

  if (session.goal != null && session.reps >= session.goal) {
    Voice.say(t("voice_goal"));
    endSession(true);
  }
}

function updateHud() {
  if (!session) return;
  els.goalPill.textContent =
    session.goal != null ? `${session.reps} / ${session.goal}` : t("open_goal");
  els.repCount.textContent = String(session.reps);
}

// ---------- Session flow ----------
let pendingExercise = null;

function openPrep(exerciseId) {
  pendingExercise = exerciseId;
  els.prepTitle.textContent = exLabel(exerciseId);
  show(FLOWS.prep);
}
document.getElementById("prep-back").addEventListener("click", showHome);
document.getElementById("btn-start").addEventListener("click", () => {
  if (pendingExercise) openGoalPicker(pendingExercise);
});
document.getElementById("btn-watch").addEventListener("click", () => {
  if (pendingExercise) openTutorial(pendingExercise);
});

const VIDEO_SRC = {
  pushup: "assets/videos/pushup-tutorial.mp4",
  surya: "assets/videos/surya-tutorial.webm",
};

function openTutorial(exerciseId, keepPosition = false) {
  pendingExercise = exerciseId;
  els.tutTitle.textContent = tpl("tut_title", { ex: exLabel(exerciseId) });
  els.tutSteps.innerHTML = (tutSteps(exerciseId) || [])
    .map((s) => `<li>${s}</li>`)
    .join("");
  const src = VIDEO_SRC[exerciseId];
  if (src && !keepPosition) {
    els.tutVideo.pause();
    els.tutVideo.src = src;
    els.tutVideo.load();
    els.tutVideo.play().catch(() => {});
  }
  show(FLOWS.tutorial);
}
document.getElementById("tut-back").addEventListener("click", () => {
  els.tutVideo.pause();
  if (pendingExercise) openPrep(pendingExercise);
});
document.getElementById("tut-start").addEventListener("click", () => {
  if (pendingExercise) openGoalPicker(pendingExercise);
});

function openGoalPicker(exerciseId) {
  pendingExercise = exerciseId;
  els.goalTitle.textContent = tpl("goal_title", { ex: exLabel(exerciseId) });
  els.goalChips.innerHTML = "";
  for (const g of GOALS[exerciseId]) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent =
      g == null ? t("open_label") : `${g} ${t(exerciseId === "surya" ? "unit_round" : "unit_reps")}`;
    btn.addEventListener("click", () => startSession(exerciseId, g));
    els.goalChips.appendChild(btn);
  }
  show(FLOWS.goal);
}
document.getElementById("goal-back").addEventListener("click", showHome);

async function startSession(exerciseId, goal) {
  paused = false;
  els.btnPause.textContent = t("pause_btn");
  els.btnPause.classList.remove("paused");
  els.repCount.textContent = "0";
  els.statusChip.classList.add("hidden");
  els.cueBanner.classList.add("hidden");
  try {
    els.error.classList.add("hidden");
    show(FLOWS.camera);
    els.loading.classList.remove("done");
    els.loadMsg.textContent = t("load_msg");
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
    Voice.say(goal == null ? t("voice_start_open") : tpl("voice_start", { n: goal }));
  } catch (err) {
    els.loadMsg.textContent = tpl("error_tpl", { m: err.message || err });
    els.loadRetry.classList.remove("hidden");
    els.loading.classList.remove("done");
  }
}
document.getElementById("load-retry").addEventListener("click", () => location.reload());

document.getElementById("cam-exit").addEventListener("click", () => {
  if (session) endSession(false); else showHome();
});
els.btnPause.addEventListener("click", () => {
  if (!session) return;
  paused = !paused;
  els.btnPause.textContent = paused ? t("resume_btn") : t("pause_btn");
  els.btnPause.classList.toggle("paused", paused);
  if (paused) Voice.say(t("voice_pause"));
});
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
    els.summaryTitle.textContent = achieved ? t("sum_win") : t("sum_done");
    els.summaryTitle.classList.toggle("win", achieved);
    const mins = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));
    els.summaryStats.innerHTML = `
      <div class="row"><span>${t("row_exercise")}</span><b>${exLabel(session.exercise)}</b></div>
      <div class="row"><span>${t("row_reps")}</span><b>${session.reps}</b></div>
      <div class="row"><span>${t("row_goal")}</span><b>${session.goal ?? t("hist_open")}</b></div>
      <div class="row"><span>${t("row_form")}</span><b>${avgForm != null ? avgForm + "%" : "--"}</b></div>
      <div class="row"><span>${t("row_time")}</span><b>${mins} ${t("min_unit")}</b></div>`;
    show(FLOWS.summary);
  }
  currentExercise = null;
  session = null;
}
document.getElementById("summary-home").addEventListener("click", showHome);

// ---------- License (Settings) ----------
async function refreshLicenseUI() {
  const ok = License.isUnlocked();
  els.statusPill.textContent = ok ? t("pill_full") : t("pill_free");
  els.statusPill.classList.toggle("paid", ok);
  els.licenseLine.textContent = ok ? t("lic_full") : t("lic_free");
}

document.getElementById("activate-btn").addEventListener("click", async () => {
  const msg = els.activateMsg;
  msg.className = "small";
  const ok = await License.activate(els.keyInput.value.trim());
  msg.textContent = ok ? t("act_ok") : t("act_err");
  msg.classList.add(ok ? "ok" : "err");
  if (ok) refreshLicenseUI();
});

// ---------- Data controls ----------
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
  const sure = confirm(t("confirm_delete"));
  if (!sure) return;
  await Storage.deleteAll();
  License._unlocked = false;
  refreshLicenseUI();
});

// ---------- Wiring: home cards -> prep flow ----------
document.querySelectorAll(".ex-card:not(.locked)").forEach((btn) =>
  btn.addEventListener("click", () => openPrep(btn.dataset.exercise))
);

// init — language, license/device fail ho to bhi home dikhe
initLang(Storage).finally(() => {
  License.init().catch(() => {}).finally(() => {
    License.getDeviceCode()
      .then((c) => { els.deviceCode.textContent = c; })
      .catch(() => {});
    applyLang();
    showHome();
  });
});
