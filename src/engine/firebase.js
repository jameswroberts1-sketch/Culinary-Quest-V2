// Replace with real keys when ready
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase, ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const cfg = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_DB_URL.europe-west1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app, db, auth;
export function ensureFirebase(){
  if (app) return { app, db, auth };
  app = initializeApp(cfg);
  db = getDatabase(app);
  auth = getAuth(app);
  onAuthStateChanged(auth, u => { if (!u) signInAnonymously(auth).catch(console.error); });
  return { app, db, auth };
}
export const dbr = (p) => ref(ensureFirebase().db, p);
export const watch = (p, cb) => onValue(dbr(p), s => cb(s.exists()?s.val():null));
export const patch = (p, delta) => update(dbr(p), delta);
export const readOnce = async (p) => (await get(dbr(p))).val();
export const write = (p, val) => set(dbr(p), val);
export const uid = () => ensureFirebase().auth.currentUser?.uid;
