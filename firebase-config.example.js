// firebase-config.example.js — Students Hub
// ─────────────────────────────────────────────────────────────────
// Copy to firebase-config.js (gitignored) and fill YOUR_API_KEY
// + YOUR_APP_ID from:
//   Firebase Console → centralhub-8727b → Project Settings → Web app
//
// Same Firebase project as Central / Academic / Teachers Hub —
// students share the centralhub-8727b backend, but live in a
// SEPARATE Firestore collection (`students/{uid}`), never in `users/{uid}`.
// ─────────────────────────────────────────────────────────────────
window.ENV = {
  FIREBASE_API_KEY:             "YOUR_API_KEY",
  FIREBASE_AUTH_DOMAIN:         "centralhub-8727b.firebaseapp.com",
  FIREBASE_PROJECT_ID:          "centralhub-8727b",
  FIREBASE_STORAGE_BUCKET:      "centralhub-8727b.firebasestorage.app",
  FIREBASE_MESSAGING_SENDER_ID: "244951050014",
  FIREBASE_APP_ID:              "YOUR_APP_ID",
};
