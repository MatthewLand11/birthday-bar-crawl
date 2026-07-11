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
  runTransaction,
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
): [T, (val: T | ((prev: T) => T)) => Promise<void>] {
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
  const setValue = async (valOrFn: T | ((prev: T) => T)): Promise<void> => {
    if (typeof valOrFn === "function") {
      let next: T | undefined;
      setLocal((prev) => {
        next = (valOrFn as (p: T) => T)(prev);
        return next;
      });
      if (db && next !== undefined) await set(ref(db, path), next);
    } else {
      setLocal(valOrFn);
      if (db) await set(ref(db, path), valOrFn);
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

/* ================================================================== */
/*  joinBarCrawl — atomic sign-up via Firebase transactions            */
/*                                                                     */
/*  1. Transaction on race/assignments: read current team counts,      */
/*     assign the new person to the smaller team (random on tie).      */
/*  2. Transaction on config/people: add the person, aborting if a     */
/*     duplicate name appeared since the UI pre-check.                 */
/*  3. If (2) aborts, roll back the assignment from (1).               */
/* ================================================================== */

type TeamId = "team1" | "team2";

export async function joinBarCrawl(
  name: string
): Promise<{ id: string; team: TeamId }> {
  if (!db) throw new Error("Not connected to Firebase.");

  const id = crypto.randomUUID();
  const trimmed = name.trim();
  const tiebreaker: TeamId = Math.random() < 0.5 ? "team1" : "team2";

  /* Step 1 — atomic team assignment */
  let assignedTeam: TeamId = tiebreaker;
  await runTransaction(ref(db, "race/assignments"), (current) => {
    const curr = (current as Record<string, string> | null) ?? {};
    const t1 = Object.values(curr).filter((t) => t === "team1").length;
    const t2 = Object.values(curr).filter((t) => t === "team2").length;
    assignedTeam =
      t1 < t2 ? "team1" : t2 < t1 ? "team2" : tiebreaker;
    return { ...curr, [id]: assignedTeam };
  });

  /* Step 2 — atomic people-list addition with duplicate guard */
  const peopleTx = await runTransaction(
    ref(db, "config/people"),
    (current) => {
      const arr = Array.isArray(current) ? current : [];
      const lower = trimmed.toLowerCase();
      if (
        arr.some(
          (p: { name?: string }) =>
            p?.name?.trim().toLowerCase() === lower
        )
      ) {
        return undefined; // abort — name taken
      }
      return [...arr, { id, name: trimmed }];
    }
  );

  if (!peopleTx.committed) {
    /* Roll back the assignment we just wrote */
    await set(ref(db, `race/assignments/${id}`), null);
    throw new Error(
      "That name was just taken by someone else. Try a different name."
    );
  }

  return { id, team: assignedTeam };
}

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
