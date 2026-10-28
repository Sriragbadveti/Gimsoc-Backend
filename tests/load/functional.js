const { spawn } = require("child_process"); const { MongoClient } = require("mongodb");
const B = "http://127.0.0.1:5055"; const sleep = (m) => new Promise((r) => setTimeout(r, m));
const post = async (u, b) => { const r = await fetch(B + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return [r.status, await r.json()]; };
(async () => {
  const c = await MongoClient.connect("mongodb://127.0.0.1:27017/gimsoc_bench?replicaSet=rs0"); const db = c.db(); await db.dropDatabase();
  await db.collection("usertickets").insertMany([
    { ticketType: "Standard+2", ticketCategory: "Standard", email: "a@x.com", paymentStatus: "completed", fullName: "A" },
    { ticketType: "Standard+3", ticketCategory: "Standard", email: "b@x.com", paymentStatus: "completed", fullName: "B" }]);
  const srv = spawn("node", [require("path").join(__dirname, "server.js"), require("path").resolve(__dirname, "../..")], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await fetch(B + "/api/test-cors"); break; } catch { await sleep(200); } }
  for (let i = 0; i < 50 && (await db.collection("workshopsessions").countDocuments()) < 26; i++) await sleep(200);
  const seat = async (code) => (await db.collection("workshopsessions").findOne({ code })).reserved;
  const ok = (name, cond) => console.log(cond ? "PASS" : "FAIL", name);
  let [s, j] = await post("/api/form/submit", { ticketType: "Basic", ticketCategory: "Basic", email: "New@X.com ", fullName: "N", paymentProofUrl: "u", headshotUrl: "u" });
  ok("normal purchase -> 201", s === 201);
  [s] = await post("/api/form/submit", { ticketType: "Online", ticketCategory: "Online", email: "new@x.com", fullName: "N", paymentProofUrl: "u" });
  ok("same email (different case/type) -> 409", s === 409);
  [s] = await post("/api/form/submit", { ticketType: "Basic", ticketCategory: "Basic", email: "(a+)+$@x.com", fullName: "N", paymentProofUrl: "u", headshotUrl: "u" });
  ok("regex characters in email handled (no crash)", s === 201 || s === 400);
  [s] = await post("/api/workshops/select", { email: "a@x.com", selections: ["T1-A", "T2-D"] });
  ok("select T1-A + T2-D -> 200", s === 200 && (await seat("T1-A")) === 1 && (await seat("T2-D")) === 1);
  [s] = await post("/api/workshops/select", { email: "a@x.com", selections: ["T1-A", "T4-D"] });
  ok("reselect keeps T1-A, frees T2-D, takes T4-D", s === 200 && (await seat("T1-A")) === 1 && (await seat("T2-D")) === 0 && (await seat("T4-D")) === 1);
  [s] = await post("/api/workshops/select", { email: "a@x.com", selections: ["T1-A", "T3-A"] });
  ok("two workshops in the same slot -> 400", s === 400);
  await db.collection("workshopsessions").updateOne({ code: "T2-D" }, { $set: { reserved: 40 } });
  [s] = await post("/api/workshops/select", { email: "a@x.com", selections: ["T1-B", "T2-D"] });
  ok("full session -> 409 and nothing leaked", s === 409 && (await seat("T1-B")) === 0 && (await seat("T1-A")) === 1 && (await seat("T4-D")) === 1);
  [s] = await post("/api/workshops/select", { email: "b@x.com", selections: ["N1A-A", "N1B-B", "N5-C"] });
  ok("Standard+3 linked-group rule -> 400", s === 400);
  [s] = await post("/api/workshops/select", { email: "nobody@x.com", selections: ["T1-A", "T2-D"] });
  ok("unknown attendee -> 404", s === 404);
  srv.kill(); await c.close(); process.exit(0);
})();
