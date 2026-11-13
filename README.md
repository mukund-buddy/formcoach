# FormCoach

Camera-verified fitness rep counter that runs **entirely on your device**. Point your phone camera at yourself, pick an exercise, and the app counts your reps, checks your form, and coaches you in Hindi — no account, no upload, no server.

**Exercises:** Pushups · Surya Namaskar (guided, pose-by-pose) · more coming

---

## Ye kaam kaise karta hai (How it works)

FormCoach ek **pure client-side PWA** hai — koi backend nahi, koi database server nahi, koi video upload nahi. Pura analysis tumhare phone/laptop ke browser mein hota hai.

### Pipeline

```
Camera (getUserMedia)
   │  video frames — kabhi upload nahi hote
   ▼
MediaPipe Pose Landmarker (Google, WASM/GPU — on-device)
   │  33 body landmarks per frame (nose, shoulders, elbows, wrists,
   │  hips, knees, ankles — x/y/z + visibility)
   ▼
Exercise State Machine (app ka apna logic — js/exercises/)
   │  angles + positions → pose/rep detection → count, form %, cues
   ▼
UI + Hindi Voice Coach (Web Speech API — bhi on-device)
   ▼
IndexedDB (browser storage — sessions, streaks, unlock state)
```

### Har layer kya karti hai

| Layer | File | Kaam |
|---|---|---|
| App shell + screens | `index.html` | Home, goal picker, camera, unlock, summary |
| Camera + pose loop | `js/app.js` | Camera stream, MediaPipe load, render loop, session flow, goals, pause |
| Skeleton drawing | `js/app.js` (drawFrame) | Canvas pe 28-point skeleton overlay |
| Exercise detection | `js/exercises/pushup.js` | Elbow-angle state machine + shoulder-motion backup counter |
| Exercise detection | `js/exercises/surya.js` | 12-pose guided sequence (Surya Namaskar sikhata hai) |
| Angle math | `js/angles.js` | 3D angle at joint, midpoints |
| Data layer | `js/storage.js` | IndexedDB: sessions, device kv, CSV export, delete-all |
| Voice | `js/voice.js` | hi-IN speech synthesis (rep counts, cues) |
| License | `js/license.js` | Ed25519 device-bound key verify (WebCrypto) |
| Service worker | `sw.js` | Offline caching (network-first app shell) |

### Rep counting ka mechanism (example: Pushup)

1. Har frame pe MediaPipe 33 landmarks deta hai
2. **Elbow angle** = angle at elbow between shoulder→elbow and elbow→wrist vectors (3D, `angleDeg`)
3. State machine: `up` → (elbow ≤ 125°) → `down` → (elbow ≥ 145°) → `up` = **+1 rep**
4. Angle smoothing (EMA) + 3-frame debounce — flicker se fake reps nahi
5. **Backup counter**: elbow readings unreliable ho jaye (arm frame se bahar, ya angle dead-zone mein atak jaye) to shoulder height ka up-down oscillation auto-calibrate hoke count karta hai
6. **Form check**: shoulder-hip-knee angle sustained 12+ frames < 150° → "Kamar seedhi rakho" (hip sag detection)
7. Debug chip screen pe live angles dikhata hai — accuracy tuning ke liye

### Surya Namaskar (guided mode)

12-pose sequence har pose ke liye simple geometric signals se detect hota hai (haath upar, haath zameen pe, lunge, plank, cobra, ulta-V...). App har step ka number + Hindi instruction dikhata aur bolta hai — user ko Surya Namaskar aata na ho to bhi seekh leta hai. Ek round = 12 poses complete.

---

## Privacy & Data

- **Video kabhi upload nahi hota** — frames sirf browser memory mein process hote hain
- Session data (reps, form %, time) **sirf tumhare device ke IndexedDB** mein
- Koi account nahi, koi analytics nahi, koi server nahi
- User apna data kabhi bhi CSV export ya poora delete kar sakta hai (Home screen)
- Model files (MediaPipe ~6MB) pehli visit pe CDN se aati hain, fir browser cache mein

---

## License system (₹49 one-time unlock)

Device-bound offline licensing — koi license server nahi:

```
App device code dikhata hai (8 chars, install-specific)
        │  user UPI se ₹49 karta hai, code WhatsApp pe bhejta hai
        ▼
Seller `formcoach-keygen` (Rust CLI) se sign karta hai:
  payload = [device_code(8B) | nonce(4B) | customer_name(≤16B)]
  key     = "FC-" + Base32(payload ‖ Ed25519_signature)
        │  key WhatsApp pe wapas
        ▼
App key verify karta hai — sirf EMBEDDED PUBLIC KEY se (js/license.js):
  - signature valid? + payload ke device code == is device ka code?
  - dono true → full unlock (device ke IndexedDB mein persist)
```

- Key **ek hi device** pe kaam karti hai — dusre device pe reject
- App offline bhi verify kar leti hai (WebCrypto Ed25519, zero network)
- Private key kabhi repo mein nahi (`keygen/formcoach-ed25519.key` gitignored, ledger docs mein tracked)

---

## Offline PWA

- Service worker app shell **network-first** cache karta hai — online pe latest version turant, offline pe cached version
- Icons cache-first
- Install karo (browser "Add to Home Screen") → baad mein bina internet bhi chalega (model files cache hone ke baad)

---

## Tech stack

| | |
|---|---|
| UI | Vanilla HTML/CSS/JS (ES modules) — koi framework nahi |
| Pose AI | MediaPipe Pose Landmarker (tasks-vision, WASM+GPU) |
| Crypto | Browser WebCrypto (Ed25519) — license verify |
| Storage | IndexedDB |
| Voice | Web Speech API (hi-IN) |
| Keygen | Rust (ed25519-dalek + data-encoding) |
| Hosting | Cloudflare Pages (free) |

## Repo structure

```
formcoach/
├── index.html              # App shell + screens
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline cache)
├── css/style.css
├── js/
│   ├── app.js              # Camera, pose loop, session/goal flow
│   ├── angles.js           # Landmark math
│   ├── storage.js          # IndexedDB layer
│   ├── voice.js            # Hindi voice coach
│   ├── license.js          # Ed25519 device-bound license verify
│   └── exercises/
│       ├── pushup.js       # Dual-counter pushup engine
│       └── surya.js        # Guided 12-pose Surya engine
├── assets/icons/           # PWA icons
├── keygen/                 # Rust license keygen (seller tool)
│   ├── Cargo.toml
│   └── src/main.rs
├── docs/ledger.md          # Private: keypair + customer records (gitignored)
└── ROADMAP.md              # Project plan + phases
```

## Development

```bash
# Local run
python -m http.server 8000        # ya start-dev.bat

# License keygen (Rust)
cd keygen && cargo build --release
target/release/formcoach-keygen.exe pubkey
target/release/formcoach-keygen.exe keygen --code <DEVICE_CODE> --name "Customer"

# Deploy (Cloudflare Pages)
npx wrangler pages deploy <dist-folder> --project-name=formcoach --branch=main
```

## Roadmap

Detailed phases, team roles aur teacher-explainer: [ROADMAP.md](ROADMAP.md)

---

**Team:** Abhinav · Om · Shivam · Vivek · Ashutosh (Class 11)
**License:** MIT — code open source hai, data tumhara hai
