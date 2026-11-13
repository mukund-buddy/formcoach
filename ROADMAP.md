# FormCoach — Project Roadmap

> **Pitch:** Pehla web app jo camera se verify karta hai ki aapne sach mein
> Surya Namaskar / exercise ki — har rep count, har form score, 100% on-device.
> Hindi voice coach included. Koi backend nahi, koi video upload nahi.

---

## 1. Product Definition

| Thing | Decision |
|---|---|
| Name | **FormCoach** |
| Type | PWA (web app jo phone pe install hota hai) + APK |
| Hook | Camera-verified Surya Namaskar (India-specific, koi competitor nahi) |
| Free tier | 2 exercises (Pushups + Surya Namaskar preview) |
| Paid | ₹49 one-time unlock — UPI + device-bound license key |
| First market | Students (classmates, school), phir family/general |
| Privacy pitch | Camera video device se bahar jaati hi nahi |

**Gap (research-verified):** Generic rep counters free hain (hammyasf, Kinetix),
aur Surya Namaskar apps sirf timer-based hain (AsanaGuru, Sun Salutos).
**Camera + pose detection + Surya Namaskar + Hindi voice** ka combination kahin nahi hai.

---

## 2. Team & Workflow (Agent Coder Model)

**Main (AI) = Agent Coder.** Tum = Product Owner.

| Role | Kaun | Kaam |
|---|---|---|
| Agent coder | AI (OpenCode/MCP, VS Code ke andar) | Poora code, architecture, bug fix, docs, deploy scripts |
| Product owner | Tum | Decisions, logo, testing feedback, selling, WhatsApp support |
| Research/evidence | Om | Licensing research (MediaPipe Apache 2.0 attribution), competitor notes |
| UI/design | Shivam | Logo finalization, UI polish feedback, colors |
| Testing/data | Vivek | 10–15 test users, accuracy notes, bug list |
| Budget/docs/business | Ashutosh | Pricing, teacher doc, revenue tracking |
| Coordination | Abhinav | Sab sync mein rakhe |

**Workflow:** Tum VS Code mein OpenCode chalate ho → main files banata/fix karta
hoon → tum browser (http://localhost) pe test karte ho → feedback → repeat.
Har feature chhote commits/iterations mein.

---

## 3. Architecture (No Backend)

```
[Browser / WebView]
 ├─ Camera (getUserMedia) — live feed, upload kabhi nahi
 ├─ MediaPipe Pose Landmarker (Apache 2.0, WASM, on-device)
 │    → 33 landmarks per frame (shoulders, elbows, hips, knees...)
 ├─ Exercise Engine (JS v1; optional Rust→WASM v2)
 │    → joint angles → state machine (pose A→B→A = 1 rep)
 │    → form rules (angle thresholds) → form score %
 ├─ Voice Coach — Web Speech API (Hindi, offline-capable)
 ├─ Storage — IndexedDB (streaks, history, CSV export)
 ├─ License — Ed25519 public-key verify (device-bound, offline)
 └─ PWA + Service Worker — installable, offline
[Cloudflare Pages] — static hosting, free, unlimited bandwidth
[Rust keygen CLI] — sirf tumhare PC pe; license keys sign karta hai
```

**Rust kahan:** (1) `formcoach-keygen` CLI — license keys banane ke liye
(`ed25519-dalek`), (2) optional v2: rep-engine WASM build. Baaki JS —
kyunki camera/pose layer browser ka kaam hai.

---

## 4. File Structure

```
G:\Development\JavaScript\formcoach\
├── ROADMAP.md            ← ye file
├── LOGO_PROMPT.md        ← logo AI prompts
├── README.md             ← run/build instructions
├── index.html            ← app shell (camera + UI)
├── manifest.json         ← PWA manifest
├── sw.js                 ← service worker (offline)
├── css\style.css
├── js\
│   ├── app.js            ← camera + MediaPipe init + render loop
│   ├── storage.js        ← IndexedDB (history, streaks, settings)
│   ├── voice.js          ← Hindi speech feedback
│   ├── license.js        ← key verify + unlock state
│   └── exercises\
│       ├── pushup.js     ← state machine + angle rules
│       └── surya.js      ← 12-pose Surya Namaskar machine
├── assets\icons\         ← logo yahan (tum banaoge)
├── keygen\               ← Rust CLI (license keys)
│   ├── Cargo.toml
│   └── src\main.rs
└── docs\                 ← teacher doc, license ledger (keys/naam)
```

---

## 5. Build Phases

### Phase 0 — Setup (aaj)
- [x] Folder structure
- [x] ROADMAP + LOGO_PROMPT
- [x] Rust keygen CLI — build + E2E crypto test PASS (Rust sign → JS verify)
- [ ] Logo generate (tum) → icons banaunga
- [ ] Browser mein camera + pose skeleton test (tumhara phone/laptop chahiye)

### Phase 1 — MVP Engine (Week 1–2)
- [ ] Pushup counter (state machine, ~120 lines)
- [ ] Surya Namaskar: 12-pose state machine (core technical challenge)
- [ ] Form score: 3–4 angle rules per exercise
- [ ] Counter UI + skeleton overlay on canvas
- [ ] Streaks + session history (IndexedDB)

### Phase 2 — Coach Feel (Week 2–3)
- [ ] Hindi voice feedback ("Achhe se karo!", "5 ho gaye!")
- [ ] Session summary screen (reps, form %, time)
- [ ] CSV export (Vivek ke testing data ke liye)

### Phase 3 — Test (Week 3)
- [ ] 10–15 users (classmates + family): accuracy + phone-compat notes
- [ ] Fix list priority karo; low-end phone pe lite model use karo

### Phase 4 — Money (Week 4)
- [ ] Free/paid gate: 2 exercises free, baaki lock
- [ ] Rust keygen CLI: keys sign karo, docs/ledger mein naam+device code
- [ ] Unlock screen: device code + UPI QR + key input
- [ ] "Restore purchase" flow

### Phase 5 — Ship (Week 4–5)
- [ ] Cloudflare Pages deploy (free)
- [ ] PWABuilder → TWA APK (free) — WhatsApp/Telegram se distribute
- [ ] Sell: classmates, school groups, family networks
- [ ] ₹ revenue → domain kharido (Cloudflare Registrar, at-cost)

### Phase 6 — Expand (school project ke baad)
- [ ] More exercises: squats, plank, baithak, dand
- [ ] Optional: Rust→WASM rep engine (speed showcase)
- [ ] School license idea: ek school ke liye bulk key

---

## 6. License System (No-Backend Single-Use Keys)

**Scheme: Ed25519 device-bound keys** (jaisa real software use karta hai):

1. App mein sirf **PUBLIC key** hai (forge impossible, private key tumhare keygen mein).
2. Unlock screen pe app apna **DEVICE CODE** dikhata hai (install-UUID derived,
   8 char, e.g. `7KX2-9QMF`) — IndexedDB mein permanent.
3. User UPI ₹49 → WhatsApp pe screenshot + device code + naam bhejta hai.
4. Tum keygen chalate ho: `formcoach-keygen --code 7KX2-9QMF --name "Rahul"`
   → key output (payload = device_code + naam + nonce + validity, signed).
5. User key enter karta hai → signature verify + device code match → unlock
   → IndexedDB mein save → **kabhi dobara nahi poochhega**.
6. Doosre phone pe = device mismatch = **REJECT** → key share bekaar →
   naye device ke liye nayi key generate karni padegi (jaisa tum chahte ho).
7. Data clear/phone badla → "Restore" button → purana proof + naya device code
   → tum nayi key issue karte ho (paise dobara nahi).
8. Ledger: `docs\ledger.md` mein har key ka record (naam, device code, date) —
   duplicate issue se bachne ke liye.

**Backup (agar piracy dikhe):** Cloudflare Worker activation endpoint (free
100k req/day) baad mein add ho sakta hai — abhi nahi.

---

## 7. Deployment & APK Plan

1. **VS Code se hi sab banega** — APK banane ke liye pehle URL chahiye:
   code → Cloudflare Pages (drag-drop ya Git) → `formcoach.pages.dev`.
2. **PWABuilder.com** (Microsoft, free) → URL daalo → Android "Other Android"
   tab → TWA APK download. Ye proper manifest/TWA support karta hai —
   **ye primary hai, freewebtoapk.com sirf fallback** agar PWABuilder pe koi
   dikkat aaye.
3. Play Store skip (US$25 + families-policy webview rejection ka risk) —
   APK direct distribution hi hai.
4. Domain (~₹800–1,000/saal, .in ya .com, Cloudflare Registrar at-cost)
   revenue aane ke baad — usse se pehle `*.pages.dev` free URL kaafi hai.

---

## 8. Budget (₹0 upfront)

| Item | Cost |
|---|---|
| MediaPipe / wger / fonts / Chart.js | ₹0 (open source) |
| Cloudflare Pages hosting (free tier, commercial allowed) | ₹0 |
| PWABuilder APK | ₹0 |
| OpenCode/MCP/VS Code | ₹0 |
| **Domain (baad mein, revenue se)** | ₹800–1,000/yr |
| **School budget ₹11,000** | **zaroorat nahi** — jo bacha wo backup |

---

## 9. Teacher Ko Kya Batana Hai (English, clean)

**What it is:** FormCoach is a progressive web app that uses a phone camera and
on-device AI (MediaPipe Pose Landmarker, Apache 2.0 licensed, made by Google)
to detect 33 body landmarks in real time. A rule-based state machine converts
joint angles into rep counts and a form score, and a Hindi voice coach gives
instant feedback.

**How it works (3 steps):**
1. Camera feed stays on the device — no video is ever uploaded.
2. The pose model returns body-landmark coordinates each frame; we compute
   joint angles (e.g., elbow angle for pushups, hip/shoulder angles for the
   12 poses of Surya Namaskar).
3. A finite-state machine tracks pose transitions; when the full sequence
   completes, one rep is counted. Angle thresholds also produce a form
   percentage, so the app knows *whether* the exercise was done correctly,
   not just *that* it was done.

**Why it is unique:** Existing Surya Namaskar apps are timer-based — they
cannot verify the user actually exercised. Generic rep counters exist, but
none offer camera verification for Indian exercises, Hindi coaching, or
progress reports. We surveyed tools (AsanaGuru, Sun Salutos, AI Rep Counter,
Kinetix) and combined what none of them offers.

**Engineering highlights:**
- 100% client-side PWA — no backend server, works offline after install.
- Privacy by design: video never leaves the device.
- A Rust command-line tool generates cryptographically signed,
  device-bound license keys (Ed25519) so each paid key works on exactly one
  device — a real-world offline licensing scheme.
- Deployed on Cloudflare Pages (free tier); installable on Android via
  PWABuilder.

**Business model:** 2 exercises free; ₹49 one-time unlock via UPI with a
signed license key. Revenue funds a custom domain (~₹800–1,000/year).

---

## 10. Risks (Honest)

| Risk | Status |
|---|---|
| Surya Namaskar 12-pose detection accuracy | Hardest technical part; lite model + generous thresholds + testing loop |
| Low-end phones slow | pose_landmarker_lite model; 15–20 fps acceptable hai counting ke liye |
| JS patch karke unlock | Possible in theory (har client app ki limit); ₹49-scale pe ignore |
| Key share karke use | Device-binding se solve; baki restore flow |
| Health claims | Sirf "fitness support" language; koi medical/diagnosis claim nahi |

---

## 11. Success Metrics

- MVP working on 10+ different phones (accuracy test pass)
- 5+ paying customers (₹245+) before exhibition
- 1 live demo: camera pe 3 Surya Namaskar rounds count + form feedback
- Teacher pitch doc + live demo = school project submission
