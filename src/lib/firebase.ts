import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Firebase web config — these values are publishable (safe to commit).
// Security is enforced by Firebase Auth + Database Rules, not by hiding the config.
const firebaseConfig = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)?.trim() ||
    (import.meta.env.GOOGLE_API_KEY as string | undefined)?.trim() ||
    "@secret:GOOGLE_API_KEY".trim(),
  authDomain: "powerlifting-369a7.firebaseapp.com",
  databaseURL: "https://powerlifting-369a7-default-rtdb.firebaseio.com",
  projectId: "powerlifting-369a7",
  storageBucket: "powerlifting-369a7.firebasestorage.app",
  messagingSenderId: "874651725070",
  appId: "1:874651725070:web:7c7d8a71ec9c40614e3b5f",
};

const hasPlaceholder =
  firebaseConfig.apiKey.includes("your-api-key") ||
  firebaseConfig.databaseURL.includes("your-project") ||
  firebaseConfig.projectId.includes("your-project");

/** When false the app uses localStorage only; all Firebase calls are skipped. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    !hasPlaceholder,
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;

if (isFirebaseConfigured) {
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _auth = getAuth(_app);
  _db = getDatabase(_app);
}

export const firebaseApp = _app;
export const firebaseAuth = _auth;
export const firebaseDb = _db;
