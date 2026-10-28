// Paste your Firebase web app settings here (Firebase console → Project settings → Your apps → Web app → Config).
// These values are not secret: they identify your project. The security rules in firestore.rules and storage.rules protect the data.
export const firebaseConfig = {
  apiKey: "PASTE-API-KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "",
  appId: "",
};

export const appOptions = {
  // Sign-in buttons to show: "google", "microsoft" (Microsoft needs extra setup, see README).
  providers: ["google"],
  // Only let these school email domains in, e.g. ["hunterbusinessschool.edu"]. Empty = any account.
  // Also set the same domain in firestore.rules so the server enforces it.
  allowedDomains: [],
  // true on shared lab computers: signs the student out after every ticket.
  kioskMode: false,
  // Photo uploads need Firebase Storage (Blaze plan, see README). Set to false to hide photo uploads.
  photos: true,
};
