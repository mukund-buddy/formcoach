// License — Ed25519 device-bound offline keys
// Browser ke apne WebCrypto (Ed25519) se verify — koi CDN dependency nahi,
// isliye app shell kabhi blank nahi hogi chahe internet na ho.
//
// App sirf PUBLIC key jaanta hai; private key sirf keygen CLI (Rust) mein hai.
//
// Key layout: base32( payload || signature ) formatted "FC-XXXXXX-XXXXXX..."
// payload: [0..8)  device code (8 ASCII chars)
//          [8..12) nonce (4 bytes, uniqueness ke liye)
//          [12..)  customer name (UTF-8, <=16 bytes)

import { Storage } from "./storage.js";

// == PUBLIC KEY: keygen `pubkey` output (docs/ledger.md se match karo) ==
const PUBLIC_KEY_HEX = "b2c9f56ef85bcfa5ce4674461d51f5144e3e486f53cebc7a23831afb0b1f55d7";

const RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // keygen BASE32_NOPAD se match

function base32Decode(str) {
  const clean = str.toUpperCase().replace(/-/g, "").replace(/^FC/, "");
  const out = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    const idx = RFC4648.indexOf(ch);
    if (idx < 0) throw new Error("bad char");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function hexToBytes(hex) {
  if (hex.startsWith("PASTE_")) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySig(payload, sig) {
  const pub = hexToBytes(PUBLIC_KEY_HEX);
  if (pub.length !== 32) throw new Error("public key galat set hui hai");
  const key = await crypto.subtle.importKey("raw", pub, { name: "Ed25519" }, true, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, sig, payload);
}

export const License = {
  _unlocked: false,

  async getDeviceCode() {
    let uuid = await Storage.kvGet("install_uuid");
    if (!uuid) {
      uuid = crypto.randomUUID();
      await Storage.kvSet("install_uuid", uuid);
    }
    const hex = await sha256Hex(uuid + "|formcoach");
    // 8-char device code, ambiguous letters avoid karne ke liye mapped
    const raw = hex.slice(0, 8).toUpperCase();
    return raw.replace(/O/g, "0").replace(/[IL]/g, "1");
  },

  isUnlocked() {
    return License._unlocked === true;
  },

  async init() {
    License._unlocked = (await Storage.kvGet("unlocked")) === true;
    return License._unlocked;
  },

  async activate(keyText) {
    try {
      const bytes = base32Decode(keyText);
      if (bytes.length < 12 + 64) return false;
      const payload = bytes.slice(0, bytes.length - 64);
      const signature = bytes.slice(bytes.length - 64);

      if (!(await verifySig(payload, signature))) return false;

      const myCode = await this.getDeviceCode();
      const keyCode = new TextDecoder().decode(payload.slice(0, 8));
      if (keyCode !== myCode) return false; // doosre device ki key

      await Storage.kvSet("unlocked", true);
      License._unlocked = true;
      return true;
    } catch {
      return false;
    }
  },
};
