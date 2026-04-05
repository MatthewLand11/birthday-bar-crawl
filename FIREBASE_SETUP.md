# Firebase Setup Guide

Follow these steps to enable real-time sync across phones. Takes about 5 minutes.

---

## Step 1: Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Create a project** (or **Add project**)
3. Name it something like `beck-bar-crawl`
4. You can disable Google Analytics (not needed)
5. Click **Create project**, wait a moment, then click **Continue**

## Step 2: Enable Realtime Database

1. In the left sidebar, click **Build > Realtime Database**
2. Click **Create Database**
3. Choose a location (any region is fine)
4. Select **Start in test mode** (this allows all reads/writes — fine for a one-day bar crawl)
5. Click **Enable**

## Step 3: Enable Storage

1. In the left sidebar, click **Build > Storage**
2. Click **Get started**
3. Select **Start in test mode**
4. Click **Next**, pick a location, then **Done**

## Step 4: Register a Web App

1. On the project home page, click the **</>** (web) icon to add a web app
2. Give it a nickname like `bar-crawl-web`
3. You do NOT need Firebase Hosting — leave it unchecked
4. Click **Register app**
5. You'll see a config object that looks like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "beck-bar-crawl.firebaseapp.com",
  databaseURL: "https://beck-bar-crawl-default-rtdb.firebaseio.com",
  projectId: "beck-bar-crawl",
  storageBucket: "beck-bar-crawl.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 5: Paste Config into `.env.local`

Open the `.env.local` file in the project root and fill in the values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=beck-bar-crawl.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://beck-bar-crawl-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=beck-bar-crawl
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=beck-bar-crawl.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 6: Restart the Dev Server

After saving `.env.local`, restart the dev server:

```
npm run dev
```

You should see a small green **"Live sync on"** dot at the bottom of the main page. That means Firebase is connected.

---

## How It Works

- **Without Firebase** (`.env.local` values are blank): the app uses localStorage, same as before. Only works on one device.
- **With Firebase** (values filled in): all race state, photos, team assignments, and config sync in real-time across every phone that opens the URL.

## Test Mode Warning

Test mode security rules expire after 30 days. For a one-day bar crawl this is fine. If you want to keep the project longer, update the rules in the Firebase console under Realtime Database > Rules and Storage > Rules.
