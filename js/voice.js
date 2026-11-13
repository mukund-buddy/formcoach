// Voice feedback — Web Speech API (offline-capable on Android Chrome)
// Locale follows selected language: hinglish/hindi -> hi-IN, english -> en-IN
import { voiceLang } from "./i18n.js";

let voiceReady = false;

function pickVoice(locale) {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === locale) ||
    voices.find((v) => v.lang?.startsWith(locale.slice(0, 2))) ||
    (locale.startsWith("hi")
      ? voices.find((v) => v.lang?.startsWith("en-IN"))
      : null)
  );
}

speechSynthesis.onvoiceschanged = () => { voiceReady = true; };

export const Voice = {
  say(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      const locale = voiceLang();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(locale);
      if (v) u.voice = v;
      u.lang = locale;
      u.rate = 1.05;
      u.pitch = 1;
      u.volume = 1;
      speechSynthesis.cancel(); // queue jama na ho
      speechSynthesis.speak(u);
    } catch {
      /* voice fail = silent, app chalta rahega */
    }
  },
};
