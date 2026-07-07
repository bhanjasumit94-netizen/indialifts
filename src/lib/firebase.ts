import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Firebase web app configuration.
// These values are publishable (safe to ship in the client bundle);
// security is enforced by Firebase Auth + Realtime Database Rules.
const firebaseConfig = {
  apiKey: "AIzaSyD2yB9pZYUYRT5q1u-c10ClHT60x7aB260",
  authDomain: "powerlifting-369a7.firebaseapp.com",
  databaseURL: "https://powerlifting-369a7-default-rtdb.firebaseio.com",
  projectId: "powerlifting-369a7",
  storageBucket: "powerlifting-369a7.firebasestorage.app",
  messagingSenderId: "874651725070",
  appId: "1:874651725070:web:7c7d8a71ec9c40614e3b5f",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;
let _configured = false;
let _initError: Error | null = null;

try {
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _auth = getAuth(_app);
  _db = getDatabase(_app);
  _configured = true;
} catch (err) {
  _initError = err instanceof Error ? err : new Error(String(err));
  console.error("[firebase] initialization failed:", _initError.message);
}

/** When false the app uses localStorage only; all Firebase calls are skipped. */
export const isFirebaseConfigured = _configured;
export const firebaseInitError = _initError;
export const firebaseApp = _app;
export const firebaseAuth = _auth;
export const firebaseDb = _db;
