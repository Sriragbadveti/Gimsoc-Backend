// MEDCON backend benchmark: node bench.js <backendDir> <label>
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const autocannon = require("autocannon");
const jwt = require(require.resolve("jsonwebtoken", { paths: [path.resolve(process.argv[2])] }));

const BACKEND = path.resolve(process.argv[2]);
const LABEL = process.argv[3] || "run";
const PORT = 5055;
const BASE = `http://127.0.0.1:${PORT}`;
const URI = "mongodb://127.0.0.1:27017/gimsoc_bench?replicaSet=rs0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null; };
const stats = (lat) => ({ n: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: Math.max(...lat) });

async function timed(fn) { const t = performance.now(); const r = await fn(); return { ms: Math.round(performance.now() - t), r }; }
async function post(url, body) {
  const res = await fetch(BASE + url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.text() };
}

const TYPES = [["Standard+2", 190], ["Standard+3", 290], ["Standard+4", 140], ["Basic", 280], ["Online", 300]];

async function seed(db) {
  await db.dropDatabase();
  const tickets = [];
  let i = 0;
  for (const [ticketType, n] of TYPES) {
    for (let k = 0; k < n; k++, i++) {
      tickets.push({
        ticketType, ticketCategory: ticketType === "Online" ? "Online" : ticketType === "Basic" ? "Basic" : "Standard",
        subType: ["GIMSOC", "Non-GIMSOC", "TSU", "GEOMEDI"][k % 4],
        fullName: `Attendee ${i}`, email: `user${i}@example.com`, whatsapp: "+995000000",
        galaDinner: k % 5 === 0 ? "Yes, I would like to attend the Gala Dinner (+40 GEL)" : "No",
        paymentStatus: k % 10 === 0 ? "rejected" : (ticketType === "Standard+2" && k < 150) ? "completed" : k % 3 === 0 ? "pending" : "completed",
        headshotUrl: "https://res.cloudinary.com/x/h.jpg", paymentProofUrl: "https://res.cloudinary.com/x/p.jpg",
        universityName: "TSU", semester: "8", foodPreference: "Veg", createdAt: new Date(Date.now() - i * 60000), __v: 0,
      });
    }
  }
  // the first 150 Standard+2 are approved and not rejected (they'll race for workshop seats)
  tickets.filter((t) => t.ticketType === "Standard+2").slice(0, 150).forEach((t) => (t.paymentStatus = "completed"));
  await db.collection("usertickets").insertMany(tickets);
  const admin = await db.collection("admins").insertOne({ email: "bench@admin.test", password: "x", role: "admin", isActive: true, name: "Bench" });
  return { admin: admin.insertedId, total: tickets.length };
}

async function waitUp() { for (let i = 0; i < 100; i++) { try { const r = await fetch(BASE + "/api/test-cors"); if (r.ok) return; } catch {} await sleep(200); } throw new Error("server did not start"); }

async function cannon(url, connections, headers = {}) {
  const r = await autocannon({ url: BASE + url, connections, duration: 10, headers });
  return { connections, rps: Math.round(r.requests.average), p50: r.latency.p50, p97_5: r.latency.p97_5, p99: r.latency.p99, errors: r.errors, non2xx: r.non2xx, timeouts: r.timeouts };
}

(async () => {
  const client = await MongoClient.connect(URI); const db = client.db();
  const { admin, total } = await seed(db);
  const log = fs.openSync(`${__dirname}/server-${LABEL}.log`, "w");
  const srv = spawn("node", [path.join(__dirname, "server.js"), BACKEND], { stdio: ["ignore", log, log], env: { ...process.env, PORT: String(PORT) } });
  await waitUp();
  for (let i = 0; i < 50; i++) { if (await db.collection("workshopsessions").countDocuments() >= 26) break; await sleep(200); }
  await sleep(500);
  const token = jwt.sign({ adminId: admin.toString() }, "bench-secret");
  const out = { label: LABEL, seededTickets: total };

  // ---- T1: workshop seat race. 150 approved attendees, two 40-seat sessions, all click "confirm" at once
  const users = (await db.collection("usertickets").find({ ticketType: "Standard+2", paymentStatus: "completed" }).limit(150).toArray()).map((u) => u.email);
  const t1 = await Promise.all(users.map((email) => timed(() => post("/api/workshops/select", { email, selections: ["T1-A", "T2-D"] }))));
  const s1 = await db.collection("workshopsessions").find({ code: { $in: ["T1-A", "T2-D"] } }).toArray();
  const codes = {}; t1.forEach((x) => (codes[x.r.status] = (codes[x.r.status] || 0) + 1));
  out.workshopRace = {
    attendees: users.length, capacity: 40, statusCodes: codes,
    seatsReserved: Object.fromEntries(s1.map((s) => [s.code, s.reserved])),
    selectionDocs: await db.collection("workshopselections").countDocuments(),
    latencyMs: stats(t1.map((x) => x.ms)),
  };
  // consistency check: reserved counter must equal the number of selections holding that seat
  const held = await db.collection("workshopselections").countDocuments({ selections: "T1-A" });
  out.workshopRace.selectionsHoldingT1A = held;

  // ---- T2: ticket oversell race. Standard+2 cap is 200; 171 non-rejected exist (190 seeded, 19 rejected)
  const before = await db.collection("usertickets").countDocuments({ ticketType: "Standard+2", paymentStatus: { $ne: "rejected" } });
  const t2 = await Promise.all(Array.from({ length: 80 }, (_, k) => timed(() => post("/api/form/submit", {
    ticketType: "Standard+2", ticketCategory: "Standard", subType: "Non-GIMSOC", email: `race${k}@example.com`, fullName: `Racer ${k}`,
    whatsapp: "+995", paymentProofUrl: "https://res.cloudinary.com/x/p.jpg", headshotUrl: "https://res.cloudinary.com/x/h.jpg",
    galaDinner: "No", infoAccurate: "true", policies: "true", paymentMethod: "Bank Transfer",
  }))));
  const after = await db.collection("usertickets").countDocuments({ ticketType: "Standard+2", paymentStatus: { $ne: "rejected" } });
  const codes2 = {}; t2.forEach((x) => (codes2[x.r.status] = (codes2[x.r.status] || 0) + 1));
  out.ticketRace = { cap: 200, before, concurrentBuyers: 80, after, oversold: Math.max(0, after - 200), statusCodes: codes2, latencyMs: stats(t2.map((x) => x.ms)), sample: t2.find((x) => x.r.status >= 400)?.r.body?.slice(0, 160) };

  // ---- T3: duplicate-email double click: same email submitted 10x at once
  const t3 = await Promise.all(Array.from({ length: 10 }, () => post("/api/form/submit", {
    ticketType: "Basic", ticketCategory: "Basic", subType: "Non-GIMSOC", email: "doubleclick@example.com", fullName: "Dbl", whatsapp: "+995",
    paymentProofUrl: "https://res.cloudinary.com/x/p.jpg", headshotUrl: "https://res.cloudinary.com/x/h.jpg", galaDinner: "No",
  })));
  out.duplicateClick = { attempts: 10, ticketsCreated: await db.collection("usertickets").countDocuments({ email: "doubleclick@example.com" }), statusCodes: t3.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {}) };

  // ---- T4: read endpoints under sustained load (10 s each)
  const auth = { authorization: `Bearer ${token}` };
  out.load = {
    galaAvailability_c100: await cannon("/api/form/gala-availability", 100),
    workshopSessions_c100: await cannon(`/api/workshops/sessions?email=${encodeURIComponent(users[0])}`, 100),
    adminTicketSummary_c20: await cannon("/api/admin/ticket-summary", 20, auth),
    adminGetAllTickets_c10: await cannon("/api/admin/getalltickets", 10, auth),
  };
  const r = await fetch(BASE + "/api/admin/getalltickets", { headers: auth }); const txt = await r.text();
  out.getAllTicketsPayloadKB = Math.round(txt.length / 1024);
  out.getAllTicketsLeaksDashboardPassword = txt.includes("dashboardPassword");

  // ---- T5: CORS check: does an arbitrary origin get credentialed access?
  const cr = await fetch(BASE + "/api/form/gala-availability", { headers: { origin: "https://evil.example" } });
  out.corsReflectsAnyOrigin = cr.headers.get("access-control-allow-origin") === "https://evil.example" && cr.headers.get("access-control-allow-credentials") === "true";

  srv.kill(); await client.close();
  fs.writeFileSync(`${__dirname}/results-${LABEL}.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
