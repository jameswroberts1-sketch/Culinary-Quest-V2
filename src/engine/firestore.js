// path: src/engine/firestore.js
// Central Firebase / Firestore helpers for Culinary Quest

// --- Firebase modular SDK imports (from CDN) -------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// --- YOUR Firebase config --------------------------------------
// ⚠️ IMPORTANT: paste your own config values from
// Firebase console → Project settings → "Your apps" → Web app → CDN.
const firebaseConfig = {
    apiKey: "AIzaSyDfwN_5WYj9AKFqDWkEEIrUIwjL8XaZ7oQ",
    authDomain: "culinary-quest-f2777.firebaseapp.com",
    databaseURL: "https://culinary-quest-f2777-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "culinary-quest-f2777",
    storageBucket: "culinary-quest-f2777.firebasestorage.app",
    messagingSenderId: "214188908997",
    appId: "1:214188908997:web:519064cad50efe615e2bac",
    measurementId: "G-EMF9YGM2LT"
  };

// --- One-time initialisation + anonymous sign-in ----------------

let firebaseReadyPromise = null;

/**
 * Ensure Firebase app, Firestore and anonymous auth are ready.
 * All public helpers below await this first.
 */
async function ensureFirebase() {
  if (!firebaseReadyPromise) {
    firebaseReadyPromise = (async () => {
      // Initialise app + services
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      const auth = getAuth(app);

      // Make sure we have an authenticated user (for rules that require auth)
      let user;
      try {
        const cred = await signInAnonymously(auth);
        user = cred.user;
      } catch (err) {
        // If we’re already signed in, reuse that; otherwise bubble error up
        if (auth.currentUser) {
          user = auth.currentUser;
        } else {
          console.error("[firestore] Anonymous sign-in failed", err);
          throw err;
        }
      }

      const uid = user ? user.uid : null;

      return { app, db, auth, uid };
    })();
  }

  return firebaseReadyPromise;
}

// --- Public helpers used by your screens ------------------------

/**
 * Return the current anonymous uid (or null on failure).
 */
export async function getUid() {
  const { uid } = await ensureFirebase();
  return uid;
}

/**
 * Create or overwrite a game document.
 * `data` is a plain object; we always merge so you can call it again safely.
 */
export async function createGame(gameId, data) {
  if (!gameId || typeof gameId !== "string") {
    throw new Error("createGame: invalid gameId");
  }
  const { db, uid } = await ensureFirebase();
  const ref = doc(db, "games", gameId.trim());

  const nowIso = new Date().toISOString();
  const payload = {
  ...(data || {}),
  organiserUid: (data && data.organiserUid) || uid,
  createdAt: (data && data.createdAt) || nowIso,
  updatedAt: nowIso
};

await setDoc(ref, payload || {}, { merge: true });
}

/**
 * Read a game document. Returns the plain data object, or null if it doesn’t exist.
 */
export async function readGame(gameId) {
  if (!gameId || typeof gameId !== "string") {
    throw new Error("readGame: invalid gameId");
  }
  const { db } = await ensureFirebase();
  const ref = doc(db, "games", gameId.trim());
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * Apply a partial update to an existing game document.
 */
export async function updateGame(gameId, patch) {
  if (!gameId || typeof gameId !== "string") {
    throw new Error("updateGame: invalid gameId");
  }
  if (!patch || typeof patch !== "object") {
    return;
  }

  const { db } = await ensureFirebase();
  const ref = doc(db, "games", gameId.trim());
  await updateDoc(ref, { ...patch, updatedAt: new Date().toISOString() });
  }

export async function listMyOpenGames(maxResults = 25) {
  const { db, uid } = await ensureFirebase();
  if (!uid) throw new Error("Not signed in (no uid)");

  const OPEN = new Set(["draft", "links", "availability", "inProgress", "started"]);

  // Single where() only -> avoids composite index requirement
  const q = query(
    collection(db, "games"),
    where("organiserUid", "==", uid),
    limit(Math.max(50, maxResults * 4))
  );

  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filter statuses locally
  const openOnly = all.filter(g => OPEN.has(String(g.status || "draft")));

  // Sort locally (newest first)
  openOnly.sort((a, b) => {
    const ak = String(a.updatedAt || a.createdAt || "");
    const bk = String(b.updatedAt || b.createdAt || "");
    return bk.localeCompare(ak);
  });

  return openOnly.slice(0, maxResults);
}

