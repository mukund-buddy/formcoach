// IndexedDB wrapper — sessions, streaks, settings
const DB_NAME = "formcoach";
const DB_VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const Storage = {
  async saveSession(s) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").add(s);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },

  async getSessions() {
    const db = await open();
    return new Promise((res, rej) => {
      const req = db.transaction("sessions", "readonly").objectStore("sessions").getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  async kvGet(key) {
    const db = await open();
    return new Promise((res, rej) => {
      const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  async kvSet(key, value) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },

  async exportCSV() {
    const sessions = await this.getSessions();
    const rows = ["date,exercise,reps,avg_form,time_s"];
    for (const s of sessions) {
      rows.push(
        [new Date(s.startedAt).toISOString(), s.exercise, s.reps, s.avgForm ?? "", Math.round((s.endedAt - s.startedAt) / 1000)].join(",")
      );
    }
    return rows.join("\n");
  },

  async deleteAll() {
    // POORA wipe: sessions + kv (install uuid + unlock state bhi)
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(["sessions", "kv"], "readwrite");
      tx.objectStore("sessions").clear();
      tx.objectStore("kv").clear();
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },
};
