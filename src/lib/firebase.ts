/* ================================================================== */
/*  Firebase initialization, real-time sync hooks, and photo upload    */
/*                                                                     */
/*  If the NEXT_PUBLIC_FIREBASE_API_KEY env var is empty the module     */
/*  exports  db = null  and  storage = null.  Consuming code checks    */
/*  for null and falls back to localStorage.                           */
/* ================================================================== */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  type Database,
} from "firebase/database";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  type FirebaseStorage,
} from "firebase/storage";
import { useEffect, useState } from "react";

/* ---- Firebase config from env vars ---- */

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";

const firebaseConfig = {
  apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/* ---- Conditional init ---- */

let app: FirebaseApp | null = null;
let db: Database | null = null;
let storage: FirebaseStorage | null = null;

if (apiKey) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  storage = getStorage(app);
}

export { db, storage };

/** True when Firebase is configured and initialized. */
export const isFirebaseActive = (): boolean => db !== null;

/* ================================================================== */
/*  useFirebase — generic real-time sync hook                          */
/*                                                                     */
/*  Returns [value, setValue] where:                                    */
/*  - value starts as `fallback`, then updates from Firebase listener  */
/*  - setValue writes to Firebase (which triggers the listener)         */
/*  - If Firebase is off, acts as a plain useState with the fallback   */
/* ================================================================== */

export function useFirebase<T>(
  path: string,
  fallback: T
): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setLocal] = useState<T>(fallback);

  /* Attach real-time listener */
  useEffect(() => {
    if (!db) return;
    const dbRef = ref(db, path);
    const unsub = onValue(dbRef, (snap) => {
      const v = snap.val();
      if (v !== null && v !== undefined) {
        setLocal(v as T);
      }
    });
    return () => unsub();
  }, [path]);

  /* Write to Firebase (or just set local state if offline) */
  const setValue = (valOrFn: T | ((prev: T) => T)) => {
    if (typeof valOrFn === "function") {
      setLocal((prev) => {
        const next = (valOrFn as (p: T) => T)(prev);
        if (db) set(ref(db, path), next);
        return next;
      });
    } else {
      setLocal(valOrFn);
      if (db) set(ref(db, path), valOrFn);
    }
  };

  return [value, setValue];
}

/* ================================================================== */
/*  uploadPhoto — upload a file to Firebase Storage                    */
/*                                                                     */
/*  Returns the public download URL.                                   */
/*  If Firebase Storage is off, returns a local blob URL instead.      */
/* ================================================================== */

export async function uploadPhoto(
  file: File,
  path: string
): Promise<string> {
  if (!storage) {
    /* Offline fallback — local blob URL (only works on this device) */
    return URL.createObjectURL(file);
  }

  const fileRef = storageRef(
    storage,
    `${path}/${crypto.randomUUID()}-${file.name}`
  );
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}
