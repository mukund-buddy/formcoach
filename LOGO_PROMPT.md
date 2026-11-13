# FormCoach — Logo Generation Prompts

App: camera-based rep counter + form feedback (Surya Namaskar hook, Hindi voice, students).

**Kaise use kare:** Neeche ke prompts kisi bhi AI image generator mein paste karo
(Bing Image Creator / DALL-E / Leonardo / Ideogram / Midjourney). Sabse pehla
(MAIN) try karo, pasand na aaye to VARIANT 2/3. Jaisi photo ban jaye, mujhe yahan
upload kar dena aur bata dena extension (png/jpg) — main usse `assets/icons/` mein
app icons (192/512, maskable) bana dunga.

---

## MAIN PROMPT (recommended)

```
Minimal flat vector app icon for a fitness coaching app called FormCoach.
A stylized human figure in a Surya Namaskar (sun salutation yoga) forward-fold
pose, drawn as a pose-detection skeleton: small glowing dots at joints connected
by clean lines, like AI motion-tracking landmarks. Behind the figure, a rising
half sun with clean geometric rays in warm orange-gold gradient. Deep navy blue
rounded-square background with subtle dark gradient. Modern, energetic,
sporty-tech feel. Flat design, smooth curves, high contrast, no text, centered
composition, suitable as a mobile app icon at small sizes. 1024x1024.
```

## VARIANT 2 — Sun + Skeleton mark (simpler, bolder)

```
Flat minimal app icon, deep navy rounded square background. A bold geometric
rising sun symbol in orange-gold gradient, and inside the sun a simple white
stick-figure skeleton made of connected dots and lines (AI pose tracking style)
performing a yoga stretch with raised arms. Clean, modern, sporty tech logo.
No text. Flat vector style, crisp edges, centered, 1024x1024.
```

## VARIANT 3 — Playful student-friendly

```
Friendly modern app icon for a fitness coach app. A smiling energetic character
doing a yoga pose with arms stretched up, drawn in simple flat illustration
style with white pose-detection skeleton dots and lines overlaid on the body.
Warm orange and yellow sun rays radiating behind. Navy blue background, rounded
square. Colorful but clean, appealing to school students, no text, flat vector,
centered, 1024x1024.
```

## NEGATIVE PROMPT (jo generator support karta hai)

```
text, letters, words, watermark, photo, realistic human face, 3D render,
gradient mesh, clutter, busy background, thin unreadable lines, dark muddy colors
```

## TECHNICAL SPECS

- Size: 1024x1024 PNG (square)
- Style: flat vector look, high contrast
- Icon safe-zone: figure center 70% ke andar rahe (edges pe crop hone wala kuch nahi)
- Baad mein in sizes chahiye honge (main bana dunga):
  - 192x192 (normal icon), 512x512 (PWA manifest), maskable variant (padding ke saath)

## Choos karne ka test

Icon chhota karke (48px) phone home screen pe dekho —
skeleton + sun tab bhi clear dikhe to final.
