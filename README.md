# FormCoach

Camera-based rep counter + form coach (PWA). Surya Namaskar, pushups —
100% on-device, no backend. See `ROADMAP.md` for the full plan.

## Run locally (dev)

```powershell
# kisi bhi ek se:
npx serve .          # agar node hai
python -m http.server 8000   # agar python hai
```
Browser: http://localhost:8000 (camera ke liye localhost/HTTPS chahiye)

## Rust keygen (license keys)

```powershell
cd keygen
cargo build --release
# app ke license.js mein public key paste karo:
.\target\release\formcoach-keygen.exe pubkey
# key issue karo:
.\target\release\formcoach-keygen.exe keygen --code "7KX29QMF" --name "Rahul"
```

## Deploy

1. Cloudflare Pages → drag-drop ya Git connect
2. PWABuilder.com → URL → Android → APK

## Structure

- `index.html`, `css/`, `js/` — app (vanilla JS, ES modules)
- `js/exercises/` — exercise engines (angle state machines)
- `keygen/` — Rust CLI (license keys, admin-only)
- `assets/icons/` — app icons (logo aane ke baad)
- `docs/` — teacher doc, license ledger
