// Hindi voice feedback — Web Speech API (offline-capable on Android Chrome)
let voiceReady = false;

function pickHindiVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "hi-IN") ||
    voices.find((v) => v.lang?.startsWith("hi")) ||
    voices.find((v) => v.lang?.startsWith("en-IN")) ||
    null
  );
}

speechSynthesis.onvoiceschanged = () => { voiceReady = true; };

export const Voice = {
  say(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickHindiVoice();
      if (v) u.voice = v;
      u.lang = "hi-IN";
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
