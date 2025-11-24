// path: src/engine/firestore.js
// Centralised Firebase + Firestore helpers for Culinary Quest (V2)
//
// Exports:
//   - getUid()                 → Promise<string|null>
//   - createGame(gameId, data) → Promise<void>
//   - readGame(gameId)         → Promise<object|null>
//   - updateGame(gameId, patch)→ Promise<void>
//
// This module guarantees that:
//   * Firebase is initialised once
//   * Anonymous auth has finished (or failed harmlessly)
//   * All calls share the same underlying connection

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/**
 * IMPORTANT:
 * Use the SAME config you’re already using for Firestore.
 * If your current firestore.js has a firebaseConfig object, copy it here.
 */
const firebaseConfig = {
  apiKey: "PASTE_YOUR",
  authDomain: "EXISTING_FIREBASE",
  projectId: "CONFIG_HERE",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…",
};

// ---------------------------------------------------------------------------
// Single, shared Firebase initialisation + anonymous auth
// ---------------------------------------------------------------------------

let _initPromise = null;

function initFirebaseOnce() {
  if (_initPromise) return _initPromise;

  _initPromise = new Promise((resolve, reject) => {
    try {
      // Use the global firebase compat SDK that you already load in index.html
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }

      const auth = firebase.auth();
      const db   = firebase.firestore();

      // Keep it simple – no persistence needed for anon users
      if (auth && auth.setPersistence) {
        auth.setPersistence(firebase.auth.Auth.Persistence.NONE).catch(() => {});
      }

      // Make sure we always have *some* user (or null if it fails)
      auth
        .signInAnonymously()
        .then((cred) => {
          const uid = cred && cred.user ? cred.user.uid : null;
          resolve({ db, auth, uid });
        })
        .catch((err) => {
          console.warn("[firestore] anonymous sign-in failed", err);
          resolve({ db, auth, uid: null });
        });
    } catch (err) {
      console.error("[firestore] initFirebaseOnce threw", err);
      reject(err);
    }
  });

  return _initPromise;
}

// ---------------------------------------------------------------------------
// Public helpers used by the app
// ---------------------------------------------------------------------------

export async function getUid() {
  const { uid } = await initFirebaseOnce();
  return uid || null;
}

// Create or overwrite a game document
export async function createGame(gameId, data) {
  if (!gameId) {
    throw new Error("createGame: gameId is required");
  }
  const { db } = await initFirebaseOnce();

  const ref = db.collection("games").doc(gameId);
  await ref.set(data, { merge: true });

  return gameId;
}

// Read a game document (or null if it doesn't exist)
export async function readGame(gameId) {
  if (!gameId) return null;
  const { db } = await initFirebaseOnce();

  const ref  = db.collection("games").doc(gameId);
  const snap = await ref.get();

  if (!snap.exists) return null;

  const doc = snap.data() || {};
  if (!doc.gameId) doc.gameId = gameId;
  return doc;
}

// Apply a shallow patch to a game document
export async function updateGame(gameId, patch) {
  if (!gameId) {
    throw new Error("updateGame: gameId is required");
  }
  if (!patch || typeof patch !== "object") {
    return;
  }

  const { db } = await initFirebaseOnce();
  const ref = db.collection("games").doc(gameId);

  await ref.set(patch, { merge: true });
}
