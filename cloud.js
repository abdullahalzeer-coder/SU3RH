/* ------------------------------------------------------------------
 * cloud.js — Firebase Auth + Firestore sync.
 *
 * Loaded as an ES module straight from the CDN, so the app still has no build
 * step. It exposes a small API on `window.Cloud` that the classic-script app.js
 * can call, and stays completely inert if firebase-config.js is left empty —
 * the app then behaves exactly as it did before, device-only.
 *
 * Data model: ONE document per user, `users/{uid}`, holding the whole state
 * blob. It's a few KB even after years of logging, and it keeps the sync logic
 * small enough to reason about.
 * ------------------------------------------------------------------ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  doc, getDoc, setDoc, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const cfg = window.FIREBASE_CONFIG || {};
const configured = !!(cfg.apiKey && cfg.projectId);

const listeners = { auth: [], remote: [], status: [] };
const emit = (kind, payload) => listeners[kind].forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });

let auth = null;
let db = null;
let user = null;
let unsubDoc = null;

if (configured) {
  const app = initializeApp(cfg);
  auth = getAuth(app);

  // Offline cache: edits made with no signal are queued and flushed on reconnect.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
  });

  onAuthStateChanged(auth, u => {
    user = u;
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
    if (u) watchDoc(u.uid);
    emit('auth', u ? { uid: u.uid, email: u.email } : null);
  });
}

/** Live-follow the user's document so a change on another device lands here. */
function watchDoc(uid) {
  unsubDoc = onSnapshot(
    doc(db, 'users', uid),
    { includeMetadataChanges: false },
    snap => {
      // Skip echoes of our own writes — they'd clobber what the user is typing.
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) return;
      const data = snap.data();
      if (data?.state) emit('remote', data.state);
    },
    err => emit('status', { kind: 'error', message: err.message })
  );
}

/** Human-readable errors — Firebase codes are not something to show a user. */
function friendly(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/invalid-email': 'badEmail',
    'auth/missing-password': 'noPassword',
    'auth/weak-password': 'weakPassword',
    'auth/email-already-in-use': 'emailInUse',
    'auth/invalid-credential': 'wrongLogin',
    'auth/wrong-password': 'wrongLogin',
    'auth/user-not-found': 'wrongLogin',
    'auth/too-many-requests': 'tooMany',
    'auth/network-request-failed': 'netError',
    'permission-denied': 'permDenied',
    // Project-side setup not finished — say so plainly rather than leaking
    // Firebase's own wording, which means nothing to the person reading it.
    'auth/configuration-not-found': 'authNotEnabled',
    'auth/operation-not-allowed': 'authNotEnabled',
  };
  const err = new Error(map[code] || e?.message || 'unknown');
  err.i18n = map[code] || null;
  return err;
}

window.Cloud = {
  configured,

  on(kind, fn) { listeners[kind]?.push(fn); },

  currentUser: () => (user ? { uid: user.uid, email: user.email } : null),

  async signUp(email, password) {
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { throw friendly(e); }
  },

  async signIn(email, password) {
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { throw friendly(e); }
  },

  async signOut() {
    if (unsubDoc) { unsubDoc(); unsubDoc = null; }
    await fbSignOut(auth);
  },

  async resetPassword(email) {
    try { await sendPasswordResetEmail(auth, email); }
    catch (e) { throw friendly(e); }
  },

  /** Read the stored state once (used for the first-login merge). */
  async fetchOnce() {
    if (!user) return null;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      return snap.exists() ? (snap.data().state ?? null) : null;
    } catch (e) { throw friendly(e); }
  },

  /** Write the whole state. Offline, Firestore queues this and sends it later. */
  async push(state) {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        state,
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now(),   // serverTimestamp is null until it lands; this is readable offline
      });
      emit('status', { kind: 'synced', at: Date.now() });
    } catch (e) {
      emit('status', { kind: 'error', message: e.message });
    }
  },
};

window.dispatchEvent(new Event('cloud-ready'));
