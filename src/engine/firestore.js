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

// --- app + db singletons ------------------------------------------

let _app;
let _db;
let _auth;
let _authReadyPromise;

/**
 * Initialise Firebase and Firestore exactly once.
 */
function ensureFirebase() {
  if (!_app) {
    // Re-use an existing app if something else created one
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    _db = getFirestore(_app);
    _auth = getAuth(_app);

    // Kick off anonymous auth and expose a promise we can await
    _authReadyPromise = new Promise((resolve) => {
      let resolved = false;

      const finish = (userOrNull) => {
        if (!resolved) {
          resolved = true;
          resolve(userOrNull);
        }
      };

      onAuthStateChanged(
        _auth,
        (user) => {
          if (user) {
            finish(user);
          } else {
            // No user yet – sign in anonymously
            signInAnonymously(_auth)
              .then((cred) => finish(cred.user || null))
              .catch((err) => {
                console.warn("[firestore] anonymous sign-in failed", err);
                finish(null);
              });
          }
        },
        (err) => {
          console.warn("[firestore] onAuthStateChanged error", err);
          finish(null);
        }
      );

      // Safety net: if nothing fires, at least *try* to sign in
      signInAnonymously(_auth).catch(() => {
        /* ignore – onAuthStateChanged will handle outcome */
      });
    });
  }

  return { db: _db, auth: _auth, authReady: _authReadyPromise };
}

/**
 * Wait for Firebase + auth to be ready before any DB call.
 */
async function ensureReady() {
  const { db, authReady } = ensureFirebase();
  // Wait for auth, but even if it fails we still return db so reads can work
  try {
    await authReady;
  } catch (err) {
    console.warn("[firestore] authReady rejected", err);
  }
  return db;
}

// --- public API ----------------------------------------------------

/**
 * Get the current user’s UID (after anonymous sign-in), or null.
 */
export async function getUid() {
  const { auth, authReady } = ensureFirebase();
  try {
    const userFromListener = await authReady;
    if (userFromListener && userFromListener.uid) return userFromListener.uid;
  } catch (_) {
    // fall through to auth.currentUser
  }
  const u = auth.currentUser;
  return u && u.uid ? u.uid : null;
}

/**
 * Create / overwrite a game document at games/{gameId}.
 */
export async function createGame(gameId, data) {
  if (!gameId) throw new Error("createGame: missing gameId");
  const db = await ensureReady();
  const ref = doc(db, "games", String(gameId));
  await setDoc(ref, data, { merge: false });
}

/**
 * Read a game document from games/{gameId}.
 * Returns the plain data object, or null if not found.
 */
export async function readGame(gameId) {
  if (!gameId) throw new Error("readGame: missing gameId");
  const db = await ensureReady();
  const ref = doc(db, "games", String(gameId));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

/**
 * Shallow-merge a patch into games/{gameId}.
 */
export async function updateGame(gameId, patch) {
  if (!gameId) throw new Error("updateGame: missing gameId");
  const db = await ensureReady();
  const ref = doc(db, "games", String(gameId));
  await updateDoc(ref, patch || {});
}
