# Student Tech Help Desk

A help desk app for students. Students sign in with their school Google account, walk through
device-specific fixes (sign-in problems, Wi-Fi, passwords, charging and more, in English or Spanish),
and send a ticket with photos when the fixes don't work. IT works the tickets on a separate desk page.

- **Student app:** `https://pmjakejm519.github.io/student-dashboard/`
- **IT desk:** `https://pmjakejm519.github.io/student-dashboard/#desk`

Students can install it like an app: open the link on a phone, then **Share → Add to Home Screen** (iPhone/iPad)
or **⋮ → Add to Home screen / Install app** (Android, Chrome on a computer).

## One-time setup (about 20 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Create a project**. Name it `student-dashboard`. You can turn Google Analytics off.
2. **Sign-in:** *Build → Authentication → Get started → Sign-in method → Google → Enable*. Pick your email as the support email and **Save**.
   Then *Authentication → Settings → Authorized domains → Add domain* and add `pmjakejm519.github.io`.
3. **Database:** *Build → Firestore Database → Create database*. Choose a location near you (for example `us-east1`) and **Start in production mode**.
4. **Photos:** *Build → Storage → Get started*, production mode, same location.
   Firebase asks you to upgrade to the **Blaze** plan for Storage. It needs a card on file, but a school help desk stays far inside the free monthly allowance
   (5 GB of photos). Set a budget alert of $1 under *Usage and billing → Details & settings* so you're never surprised.
   Don't want billing? Skip this step and set `photos: false` in `firebase-config.js`. Everything else still works.

### 2. Lock it down
1. *Firestore Database → Rules*: replace everything with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
2. *Storage → Rules*: replace everything with [`storage.rules`](storage.rules) and **Publish**. If Firebase asks to let Storage rules read Firestore, click **Grant** (that's how it knows who is IT).
3. **Only your school's accounts (recommended):** in `firestore.rules`, change the `signedIn()` line as the comment above it shows, then publish again.
   Also put your domain in `allowedDomains` in `firebase-config.js`, for example `["hunterbusinessschool.edu"]`.

### 3. Connect the app to Firebase
1. *Project settings (gear icon) → General → Your apps → Web (`</>`)*. Name it "Help desk" and click **Register app** (skip Firebase Hosting).
2. Copy the values from the `firebaseConfig` it shows.
3. On GitHub, open [`firebase-config.js`](firebase-config.js), click the pencil icon, paste the values over the placeholders, and **Commit changes**.
   These values aren't secret. The rules from step 2 are what protect the data.

### 4. Put it online with GitHub Pages
*Repository Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.*
After a minute the app is live at `https://pmjakejm519.github.io/student-dashboard/`.

### 5. Make yourself IT staff
1. Open the app and sign in with your Google account once.
2. In Firebase: *Authentication → Users*, copy your **User UID**.
3. *Firestore Database → Data → Start collection*: collection ID `admins`, document ID = your UID, add a field `name` = `Jake`, **Save**.
4. Open `…/student-dashboard/#desk`. You'll see the ticket queue. Click **School info & settings** to add the password reset link, Wi-Fi name, hours and room.

To add another IT person, have them sign in once and repeat step 5 with their UID.

## Who can do what

| | Students | IT (in `admins`) |
|---|---|---|
| Send tickets, photos, messages | Their own only (3 per 15 min, 10 open max) | Yes |
| See tickets | Their own, by ticket number + phone | All |
| Change status, reply, delete, block | No | Yes |
| Change school info / announcement | No | Yes |
| Anything else in the database | No | No |

Blocked accounts can't send tickets and drop out of the IT queue (see "Blocked accounts" in the filter).

## Options (`firebase-config.js`)
- `allowedDomains`: only let school accounts in.
- `kioskMode: true`: for shared lab computers. Signs the student out after every ticket.
- `providers: ["google", "microsoft"]`: adds a Microsoft sign-in button. This needs a Microsoft Entra app registration; see
  <https://firebase.google.com/docs/auth/web/microsoft-oauth>.
- `photos: false`: hides photo uploads (no Storage / Blaze plan needed).

## Testing
`npm install` then `npm test` runs the security-rule tests against the Firebase emulators (needs Java).

## Files
- `index.html`: the whole app (student pages + IT desk)
- `app/firebase-bridge.js`: sign-in, database and photo storage
- `firebase-config.js`: your project settings and options
- `firestore.rules`, `storage.rules`: security rules
- `manifest.webmanifest`, `sw.js`, `icons/`: install-as-app support
