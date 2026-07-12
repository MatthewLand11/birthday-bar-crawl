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

if (apiKey) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { db };

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

/* ================================================================== */
/*  uploadPhoto — compress + store as base64 in Realtime Database      */
/*                                                                     */
/*  Photos are resized to max 800px, JPEG-compressed, then stored      */
/*  as data URLs in RTDB (no Firebase Storage / Blaze plan needed).    */
/* ================================================================== */

/* ================================================================== */
/*  Cloudinary upload (free tier — 25GB storage, video + image)        */
/*  Falls back to base64-in-RTDB for images if not configured.         */
/* ================================================================== */

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";
const cloudinaryEnabled = cloudName !== "" && uploadPreset !== "";

function compressImageToBlob(
  file: File,
  maxWidth = 1200,
  quality = 0.7
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Compression failed"));
          },
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(file: File | Blob, resourceType: "image" | "video"): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }

  const data = await res.json();
  return data.secure_url as string;
}

export async function uploadPhoto(
  file: File,
  _path: string
): Promise<string> {
  if (!cloudinaryEnabled) {
    if (file.type.startsWith("image/")) {
      const blob = await compressImageToBlob(file);
      return URL.createObjectURL(blob);
    }
    throw new Error("Video uploads require Cloudinary to be configured.");
  }

  if (file.type.startsWith("image/")) {
    const compressed = await compressImageToBlob(file);
    return uploadToCloudinary(compressed, "image");
  }

  return uploadToCloudinary(file, "video");
}
