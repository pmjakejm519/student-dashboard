// Connects the help desk page to Firebase. The page was written against a small
// `claude.use("db" | "user" | "assets")` interface; this module provides the same
// interface on top of Firebase Auth, Firestore and Storage.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  GoogleAuthProvider, OAuthProvider, browserLocalPersistence, setPersistence, connectAuthEmulator, signInWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, connectFirestoreEmulator, doc as fsDoc, collection as fsCollection, getDoc, setDoc, deleteDoc, onSnapshot as fsOnSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, connectStorageEmulator, ref as stRef, uploadBytes, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig, appOptions } from "../firebase-config.js";

const opts = { providers: ["google"], allowedDomains: [], kioskMode: false, photos: true, useEmulators: false, ...appOptions };
const notConfigured = !firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE");

// ---------- Sign-in screen ----------
const gate = document.createElement("div");
gate.id = "hd-gate";
gate.innerHTML = `
  <style>
    #hd-gate { position: fixed; inset: 0; z-index: 50; background: var(--bg); display: grid; place-items: center;
      padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }
    #hd-gate .card { width: min(420px, 100%); background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 28px 24px; display: grid; gap: 14px; text-align: center; }
    #hd-gate h1 { font-family: var(--font-display); font-size: 24px; margin: 0; }
    #hd-gate p { margin: 0; color: var(--muted); }
    #hd-gate .err { color: var(--bad); font-size: 14px; }
    #hd-gate .btn { width: 100%; padding: 11px 16px; }
  </style>
  <div class="card" role="dialog" aria-labelledby="hd-gate-h">
    <h1 id="hd-gate-h">Student Tech Help Desk</h1>
    <p id="hd-gate-p">Sign in with your school account to get help or check a ticket.</p>
    <div id="hd-gate-btns" style="display:grid;gap:8px"></div>
    <p class="err" id="hd-gate-err" hidden></p>
  </div>`;
document.body.append(gate);
const gateErr = msg => { const e = gate.querySelector("#hd-gate-err"); e.textContent = msg; e.hidden = !msg; };

if (notConfigured) {
  gate.querySelector("#hd-gate-p").textContent = "This help desk isn't set up yet. IT needs to add the Firebase settings to firebase-config.js (see the README).";
  throw new Error("firebase-config.js has not been filled in");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);
const storage = getStorage(app);
// Local testing against the Firebase emulators (npm run test). Never on in production.
if (opts.useEmulators && ["localhost", "127.0.0.1"].includes(location.hostname)) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(fs, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  window.__hdTestSignIn = (sub, email) => signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true })));
}
await setPersistence(auth, browserLocalPersistence).catch(() => {});
// Coming back from a full-page Google sign-in: surface any error instead of silently showing the button again.
getRedirectResult(auth).then(res => {
  let tried = false; try { tried = sessionStorage.getItem("hd:redirect") === "1"; sessionStorage.removeItem("hd:redirect"); } catch {}
  if (!res && tried && !auth.currentUser) gateErr("Sign-in didn't finish. Your browser may be blocking third-party cookies for this site. Allow pop-ups for this site, or try Chrome or Safari. (auth/redirect-no-user)");
}).catch(e => gateErr(`Sign-in didn't work. Try again, or ask IT for help. (${e?.code || "unknown"})`));

const PROVIDERS = {
  google: { label: "Sign in with Google", make: () => { const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" }); return p; } },
  microsoft: { label: "Sign in with Microsoft", make: () => { const p = new OAuthProvider("microsoft.com"); p.setCustomParameters({ prompt: "select_account" }); return p; } },
};
// Google's own sign-in button (Google Identity Services) signs in on this page: no pop-up to block and
// no cross-site redirect, which school browsers and strict privacy settings break.
const useGis = !!opts.googleClientId && opts.providers.includes("google");
function authMessage(code) {
  return {
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.",
    "auth/popup-closed-by-user": "The sign-in window was closed before you finished. Try again.",
    "auth/cancelled-popup-request": "",
    "auth/unauthorized-domain": "This web address isn't approved for sign-in yet. IT needs to add it under Firebase → Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed": "Google sign-in isn't turned on yet. IT needs to enable it under Firebase → Authentication → Sign-in method.",
    "auth/configuration-not-found": "Sign-in isn't set up yet. IT needs to click Get started under Firebase → Authentication.",
    "auth/network-request-failed": "Couldn't reach Google. Check your internet connection and try again.",
    "auth/invalid-credential": "Google sign-in was refused. IT should check that the Web client ID in firebase-config.js matches Firebase → Authentication → Google.",
  }[code];
}
if (useGis) {
  const holder = document.createElement("div");
  holder.id = "hd-gis"; holder.style.cssText = "display:flex;justify-content:center;min-height:44px";
  gate.querySelector("#hd-gate-btns").append(holder);
  const s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client"; s.async = true;
  s.onload = () => {
    google.accounts.id.initialize({
      client_id: opts.googleClientId,
      use_fedcm_for_button: true,
      use_fedcm_for_prompt: true,
      callback: async resp => {
        gateErr("");
        try { await signInWithCredential(auth, GoogleAuthProvider.credential(resp.credential)); }
        catch (e) { const code = e?.code || "unknown"; gateErr((authMessage(code) || "Sign-in didn't work. Try again, or ask IT for help.") + ` (${code})`); }
      },
    });
    google.accounts.id.renderButton(holder, { theme: "filled_blue", size: "large", text: "signin_with", shape: "rectangular", width: Math.min(320, holder.clientWidth || 320) });
  };
  s.onerror = () => gateErr("Couldn't load Google sign-in. Check your internet connection, or turn off ad or tracker blocking for this site.");
  document.head.append(s);
}

for (const key of opts.providers) {
  const def = PROVIDERS[key]; if (!def) continue;
  if (key === "google" && useGis) continue;
  const b = document.createElement("button");
  b.className = "btn primary"; b.type = "button"; b.textContent = def.label;
  b.addEventListener("click", async () => {
    gateErr("");
    b.disabled = true; b.textContent = "Opening Google sign-in…";
    try { await signInWithPopup(auth, def.make()); }
    catch (e) {
      const code = e?.code || "unknown";
      // Some browsers (Opera GX, strict pop-up blockers, in-app browsers) refuse the pop-up: sign in on a full page instead.
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        b.textContent = "Taking you to Google…";
        try { sessionStorage.setItem("hd:redirect", "1"); } catch {}
        return signInWithRedirect(auth, def.make());
      }
      const msg = authMessage(code);
      gateErr(msg === "" ? "" : (msg || "Sign-in didn't work. Try again, or ask IT for help.") + ` (${code})`);
    } finally { b.disabled = false; b.textContent = def.label; }
  });
  gate.querySelector("#hd-gate-btns").append(b);
}

// ---------- Sign-out control in the top bar ----------
function addSignOut(email) {
  if (document.getElementById("hd-signout")) return;
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;gap:8px;align-items:center;min-width:0";
  const who = document.createElement("span");
  who.className = "meta"; who.textContent = email || "";
  who.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px";
  const b = document.createElement("button");
  b.id = "hd-signout"; b.className = "btn small"; b.type = "button"; b.textContent = "Sign out";
  b.addEventListener("click", () => signOut(auth).then(() => location.reload()));
  wrap.append(who, b);
  document.querySelector(".bar-in")?.append(wrap);
}

// Shared lab computers: sign the student out after each ticket so the next person starts clean.
window.hdOnNewTicket = () => { if (opts.kioskMode && !isAdmin) signOut(auth).then(() => location.reload()); };

// ---------- Wait for a signed-in, allowed user ----------
let isAdmin = false;
const user = await new Promise(resolve => {
  onAuthStateChanged(auth, async u => {
    if (!u) { gate.hidden = false; return; }
    const domain = (u.email || "").split("@")[1]?.toLowerCase() || "";
    if (opts.allowedDomains.length && !opts.allowedDomains.map(d => d.toLowerCase()).includes(domain)) {
      gateErr(`Use your school account (${opts.allowedDomains.join(" or ")}). You signed in as ${u.email}.`);
      await signOut(auth);
      return;
    }
    resolve(u);
  });
});
try { isAdmin = (await getDoc(fsDoc(fs, "admins", user.uid))).exists(); } catch { isAdmin = false; }
gate.hidden = true;
addSignOut(user.email);

// ---------- The interface the page expects ----------
const asErr = e => ({ code: e?.code === "permission-denied" ? "invalid_argument" : (e?.code === "unavailable" ? "unavailable" : "invalid_argument"), message: e?.message || String(e) });
const wrapDoc = s => ({ id: s.id, exists: s.exists(), data: () => (s.exists() ? s.data() : undefined), metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites } });
const missing = id => ({ id, exists: false, data: () => undefined, metadata: { fromCache: false, hasPendingWrites: false } });

function docRef(path) {
  const ref = fsDoc(fs, path);
  return {
    id: ref.id, path,
    async get() {
      try { return wrapDoc(await getDoc(ref)); }
      catch (e) { if (e?.code === "permission-denied") return missing(ref.id); throw asErr(e); }
    },
    async set(data) { try { await setDoc(ref, data); } catch (e) { throw asErr(e); } },
    // Merge-write like the page expects: nested maps merge, arrays replace. Requires the document to exist.
    async update(data) {
      const snap = await this.get();
      if (!snap.exists) throw { code: "invalid_argument", message: "document does not exist" };
      try { await setDoc(ref, data, { merge: true }); } catch (e) { throw asErr(e); }
    },
    async delete() { try { await deleteDoc(ref); } catch (e) { throw asErr(e); } },
    onSnapshot(next, error) {
      return fsOnSnapshot(ref, s => next(wrapDoc(s)), e => { if (e?.code === "permission-denied") next(missing(ref.id)); else error?.(asErr(e)); });
    },
  };
}
const db = {
  doc: docRef,
  collection(path) {
    const ref = fsCollection(fs, path);
    return {
      path,
      doc: id => docRef(path + "/" + id),
      onSnapshot(next, error) {
        return fsOnSnapshot(ref, qs => { const docs = qs.docs.map(wrapDoc); next({ docs, size: docs.length, empty: !docs.length, metadata: {} }); },
          e => error?.(asErr(e)));
      },
    };
  },
};

const userApi = {
  id: async () => user.uid,
  isOwner: async () => isAdmin,
  canEdit: async () => isAdmin,
  can: async () => true,
};

const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");
const assets = {
  async upload(blob, o) {
    const id = hex(16);
    const r = stRef(storage, `photos/${user.uid}/${id}`);
    try {
      await uploadBytes(r, blob, { contentType: o?.type || blob.type || "image/jpeg" });
      return { id, url: await getDownloadURL(r), sizeBytes: blob.size, contentType: blob.type };
    } catch (e) { throw { code: "upload_failed", message: e?.message || String(e) }; }
  },
  async delete(id) { await deleteObject(stRef(storage, `photos/${user.uid}/${id}`)); },
};
window.hdAssetUrl = (owner, id) => getDownloadURL(stRef(storage, `photos/${owner}/${id}`));

window.__hdResolve({ db, user: userApi, assets: opts.photos ? assets : null });
