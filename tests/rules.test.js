// Security rule tests: run with `npm test` (starts the Firebase emulators).
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

let env;
const now = new Date().toISOString();
const ticket = id => ({ tickets: { [id]: { id, createdAt: now, status: "new", name: "Ana", email: "a@s.edu", phone: "5551112222", issue: "wifi", device: "win", messages: {} } } });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-helpdesk",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, "admins/jake"), { name: "Jake" });
    await setDoc(doc(db, "tickets/bob"), ticket("HD-1028-BOB1"));
    await setDoc(doc(db, "replies/ana"), { tickets: { "HD-1028-ANA1": { status: "progress" } } });
    await setDoc(doc(db, "config/school"), { notice: "hi" });
  });
});
const as = uid => env.authenticatedContext(uid, { email: uid + "@s.edu" }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test("student creates and updates their own ticket document", async () => {
  await assertSucceeds(setDoc(doc(as("ana"), "tickets/ana"), ticket("HD-1028-ANA1")));
  await assertSucceeds(setDoc(doc(as("ana"), "tickets/ana"), { tickets: { "HD-1028-ANA1": { seenAt: now } } }, { merge: true }));
  await assertSucceeds(getDoc(doc(as("ana"), "tickets/ana")));
});
test("student cannot add extra top-level fields", async () => {
  await assertFails(setDoc(doc(as("ana"), "tickets/ana"), { ...ticket("HD-1028-ANA1"), role: "admin" }));
});
test("student cannot read, edit or delete another student's tickets", async () => {
  await assertFails(getDoc(doc(as("ana"), "tickets/bob")));
  await assertFails(setDoc(doc(as("ana"), "tickets/bob"), ticket("HD-1028-HAXX")));
  await assertFails(deleteDoc(doc(as("ana"), "tickets/bob")));
});
test("student cannot delete even their own ticket document", async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "tickets/ana"), ticket("HD-1028-ANA1")));
  await assertFails(deleteDoc(doc(as("ana"), "tickets/ana")));
});
test("student reads their own IT replies but cannot write any", async () => {
  await assertSucceeds(getDoc(doc(as("ana"), "replies/ana")));
  await assertFails(setDoc(doc(as("ana"), "replies/ana"), { tickets: { "HD-1028-ANA1": { status: "resolved" } } }));
  await assertFails(getDoc(doc(as("ana"), "replies/bob")));
});
test("student reads school info but cannot change it or the block list", async () => {
  await assertSucceeds(getDoc(doc(as("ana"), "config/school")));
  await assertFails(setDoc(doc(as("ana"), "config/school"), { notice: "SCHOOL CANCELLED" }));
  await assertFails(setDoc(doc(as("ana"), "config/blocked"), { uids: {} }));
});
test("nobody can make themselves an admin", async () => {
  await assertFails(setDoc(doc(as("ana"), "admins/ana"), {}));
  await assertFails(getDoc(doc(as("ana"), "admins/jake")));
});
test("unknown collections are closed", async () => {
  await assertFails(setDoc(doc(as("ana"), "spam/x"), { a: 1 }));
  await assertFails(getDoc(doc(as("jake"), "spam/x")));
});
test("signed-out visitors get nothing", async () => {
  await assertFails(getDoc(doc(anon(), "config/school")));
  await assertFails(setDoc(doc(anon(), "tickets/x"), ticket("HD-1028-XXXX")));
});
test("blocked student cannot write", async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "config/blocked"), { uids: { ana: { at: now } } }));
  await assertFails(setDoc(doc(as("ana"), "tickets/ana"), ticket("HD-1028-ANA1")));
  await assertSucceeds(setDoc(doc(as("carl"), "tickets/carl"), ticket("HD-1028-CAR1")));
});
test("IT can read and manage everything", async () => {
  const db = as("jake");
  await assertSucceeds(getDoc(doc(db, "tickets/bob")));
  await assertSucceeds(setDoc(doc(db, "replies/bob"), { tickets: { "HD-1028-BOB1": { status: "resolved" } } }));
  await assertSucceeds(setDoc(doc(db, "config/school"), { notice: "Wi-Fi down" }));
  await assertSucceeds(setDoc(doc(db, "config/blocked"), { uids: { bob: {} } }));
  await assertSucceeds(deleteDoc(doc(db, "tickets/bob")));
});

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
test("photos: students upload images only to their own folder", async () => {
  const st = env.authenticatedContext("ana").storage();
  await assertSucceeds(uploadBytes(ref(st, "photos/ana/p1"), png, { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(st, "photos/bob/p1"), png, { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(st, "photos/ana/p2"), png, { contentType: "application/pdf" }));
  await assertFails(uploadBytes(ref(st, "photos/ana/p3"), new Uint8Array(10 * 1024 * 1024 + 1), { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(st, "other/ana.png"), png, { contentType: "image/png" }));
});
test("photos: only the student and IT can view them", async () => {
  await env.withSecurityRulesDisabled(c => uploadBytes(ref(c.storage(), "photos/ana/p9"), png, { contentType: "image/png" }));
  await assertSucceeds(getBytes(ref(env.authenticatedContext("ana").storage(), "photos/ana/p9")));
  await assertSucceeds(getBytes(ref(env.authenticatedContext("jake").storage(), "photos/ana/p9")));
  await assertFails(getBytes(ref(env.authenticatedContext("bob").storage(), "photos/ana/p9")));
});
