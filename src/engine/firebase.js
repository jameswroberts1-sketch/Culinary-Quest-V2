// Firebase init + anonymous auth + tiny helpers (ESM via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getDatabase, ref, onValue, update, get, set
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// From your project config
const cfg = {
  apiKey: "AIzaSyDfwN_5WYj9AKFqDWkEEIrUIwjL8XaZ7oQ",
  authDomain: "culinary-quest-f2777.firebaseapp.com",
  databaseURL: "https://culinary-quest-f2777-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "culinary-quest-f2777",
  storageBucket: "culinary-quest-f2777.firebasestorage.app",
  messagingSenderId: "214188908997",
  appId: "1:214188908997:web:519064cad50efe615e2bac",
  measurementId: "G-EMF9YGM2LT"
};

let app, db, auth, ready;
export function ensureFirebase(){
  if (app) return { app, db, auth, ready };
  app  = initializeApp(cfg);
  db   = getDatabase(app);
  auth = getAuth(app);
  // give every client a uid (drives DB rules)
  ready = new Promise((resolve, reject)=>{
    onAuthStateChanged(auth, async (u)=>{
      try {
        if (!u) await signInAnonymously(auth);
        resolve(auth.currentUser);
      } catch (e) { reject(e); }
    });
  });
  return { app, db, auth, ready };
}

export const dbr       = (p) => ref(ensureFirebase().db, p);
export const readOnce  = async (p) => (await get(dbr(p))).val();
export const write     = (p, v) => set(dbr(p), v);
export const watch     = (p, cb) => onValue(dbr(p), s => cb(s.exists() ? s.val() : null));
export const patchRoot = (delta) => update(ref(ensureFirebase().db, "/"), delta);
export const getUid    = async () => { ensureFirebase(); await ensureFirebase().ready; return ensureFirebase().auth.currentUser.uid; };

// Optional helper to create a blank game if missing
export async function seedDevDemo(gid = "dev-demo"){
  const path = `games/${gid}`;
  const existing = await readOnce(path);
  if (existing) return "exists";
  await write(path, { st:"lobby", p:[], sched:[], sc:{} });
  return "seeded";
}
