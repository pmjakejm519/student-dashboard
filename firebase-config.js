// Paste your Firebase web app settings here (Firebase console → Project settings → Your apps → Web app → Config).
// These values are not secret: they identify your project. The security rules in firestore.rules and storage.rules protect the data.
export const firebaseConfig = {
  apiKey: "AIzaSyAJSRh9uJrgfY6rY3H_6HHXpozmwm_A8iE",
  authDomain: "student-dashboard-f12f4.firebaseapp.com",
  projectId: "student-dashboard-f12f4",
  storageBucket: "student-dashboard-f12f4.firebasestorage.app",
  messagingSenderId: "367397083312",
  appId: "1:367397083312:web:34cd0994594278f6744375",
};

export const appOptions = {
  // Sign-in buttons to show: "google", "microsoft" (Microsoft needs extra setup, see README).
  providers: ["google"],
  // Google "Web client ID" (Firebase → Authentication → Sign-in method → Google → Web SDK configuration).
  // When set, students sign in with Google's own button, which works even where pop-ups or third-party cookies are blocked.
  googleClientId: "367397083312-da3toka0jhe4uv2t6tai3pukv6q40kr4.apps.googleusercontent.com",
  // Only let these school email domains in, e.g. ["hunterbusinessschool.edu"]. Empty = any account.
  // Also set the same domain in firestore.rules so the server enforces it.
  allowedDomains: [],
  // true on shared lab computers: signs the student out after every ticket.
  kioskMode: false,
  // Photo uploads need Firebase Storage (Blaze plan, see README). Set to false to hide photo uploads.
  photos: false,
};
