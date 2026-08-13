// ============================================================
// FIREBASE CONFIG — REPLACE THE VALUES BELOW WITH YOUR OWN
// ============================================================
//
// How to get these values (one-time setup, ~10 minutes):
//
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" — name it whatever, e.g. "tracker"
//    Disable Google Analytics (you don't need it).
// 3. Once inside your project, click the </> (Web) icon on the
//    home screen to "Add an app". Give it a nickname like "web".
//    Do NOT check "Firebase Hosting". Click Register.
// 4. It shows you a `firebaseConfig` object — copy those values
//    into the object below.
// 5. In the left menu: Build → Authentication → Get Started →
//    click "Google" → toggle Enable → save.
// 6. In the left menu: Build → Firestore Database → Create
//    database → Start in "production mode" → pick a region
//    close to you (e.g. eur3 for Europe).
// 7. Once created, go to the Rules tab and paste this:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId}/{document=**} {
//          allow read, write: if request.auth != null
//                             && request.auth.uid == userId;
//        }
//      }
//    }
//
//    Click Publish.
// 8. Back in Authentication → Settings → Authorized domains:
//    add the domain you'll host on (e.g. yourname.github.io).
//    localhost is already allowed for local testing.
//
// That's it — paste your config values below and you're done.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAQBqstuVkeP5t8OFPd7e_JAQxqsnzYngA",
  authDomain: "tracker-80e53.firebaseapp.com",
  projectId: "tracker-80e53",
  storageBucket: "tracker-80e53.firebasestorage.app",
  messagingSenderId: "36281675573",
  appId: "1:36281675573:web:04b558df883c4595c0a67c"
};
