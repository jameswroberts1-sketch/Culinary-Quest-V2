// path: src/engine/firestore.js
// Firestore setup that reuses the existing Firebase app/auth from firebase.js

import { ensureFirebase } from "./firebase.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let fsApp, fsDb, fsAuth, fsReady;

export function ensureFirestore() {
  if (fsDb) {
    return { app: fsApp, db: fsDb, auth: fsAuth, ready: fsReady };
  }

  // Reuse the app + auth you already initialise in firebase.js
  const base = ensureFirebase(); // { app, db (RTDB), auth, ready }
  fsApp  = base.app;
  fsAuth = base.auth;
  fsDb   = getFirestore(fsApp);
  fsReady = base.ready; // same anonymous-auth “ready” promise
  return { app: fsApp, db: fsDb, auth: fsAuth, ready: fsReady };
}

export async function getUid() {
  const { auth, ready } = ensureFirestore();
  await ready;
  return auth.currentUser && auth.currentUser.uid;
}

export function gameDoc(gameId) {
  const { db } = ensureFirestore();
  return doc(db, "games", String(gameId));
}

export async function readGame(gameId) {
  const snap = await getDoc(gameDoc(gameId));
  return snap.exists() ? snap.data() : null;
}

export async function createGame(gameId, data) {
  const ref = gameDoc(gameId);
  // merge:true means we don't blow away future fields like RSVPs/scores
  await setDoc(ref, data, { merge: true });
}

export async function updateGame(gameId, patch) {
  const ref = gameDoc(gameId);
  await updateDoc(ref, patch);
}
