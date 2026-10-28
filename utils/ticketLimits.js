const mongoose = require("mongoose");
const UserTicket = require("../models/userModel");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GALA_LIMIT = 150;

// Per-ticket-type cap. Returns { key, limit, query } or null when the type is uncapped.
function overallRule(ticketType) {
  if (ticketType === "Standard+2") return { key: "type:Standard+2", limit: 200, query: { ticketType: "Standard+2" } };
  if (ticketType === "Standard+3") return { key: "type:Standard+3", limit: 300, query: { ticketType: "Standard+3" } };
  if (ticketType === "Standard+4" || ticketType === "Standard")
    return { key: "type:Standard+4", limit: 150, query: { $or: [{ ticketType: "Standard+4" }, { ticketType: "Standard" }] } };
  if (typeof ticketType === "string" && ticketType.startsWith("Doctor"))
    return { key: "type:Doctor", limit: 30, query: { ticketType: { $regex: /^Doctor/i } } };
  if (ticketType === "Online") return { key: "type:Online", limit: 500, query: { ticketType: "Online" } };
  if (ticketType === "Basic") return { key: "type:Basic", limit: 300, query: { ticketType: "Basic" } };
  return null;
}

// Internal member caps (across ticket types, GEOMEDI only on Standard+2).
function internalRule(subType, ticketType) {
  if (subType === "Executive")
    return { key: "sub:Executive", limit: 60, query: { subType: "Executive" }, message: "Executive & Subcommittee tickets are sold out." };
  if (subType === "TSU") return { key: "sub:TSU", limit: 50, query: { subType: "TSU" }, message: "TSU student tickets are sold out." };
  if (subType === "GEOMEDI" && ticketType === "Standard+2")
    return { key: "sub:GEOMEDI", limit: 30, query: { subType: "GEOMEDI", ticketType: "Standard+2" }, message: "GEOMEDI student tickets for Standard+2 are sold out." };
  return null;
}

const notRejected = { paymentStatus: { $ne: "rejected" } };

/**
 * Checks every cap that applies to this purchase. Returns { status, message } when the
 * purchase must be refused, or null when it may proceed. Pass a session to run the
 * checks inside a transaction.
 */
async function checkTicketLimits({ ticketType, subType, wantsGala, email }, session = null) {
  const opt = session ? { session } : {};
  const overall = overallRule(ticketType);
  const internal = internalRule(subType, ticketType);

  const [overallCount, internalCount, galaCount, existing] = await Promise.all([
    overall ? UserTicket.countDocuments({ ...overall.query, ...notRejected }, opt) : 0,
    internal ? UserTicket.countDocuments({ ...internal.query, ...notRejected }, opt) : 0,
    wantsGala ? UserTicket.countDocuments({ galaDinner: { $regex: /Yes/i }, ...notRejected }, opt) : 0,
    email ? UserTicket.findOne({ email: { $regex: new RegExp(`^${escapeRegex(email)}$`, "i") }, ...notRejected }, { _id: 1 }, opt).lean() : null,
  ]);

  if (overall && overallCount >= overall.limit) return { status: 409, message: "Tickets for this category are sold out." };
  if (internal && internalCount >= internal.limit) return { status: 409, message: internal.message };
  if (wantsGala && galaCount >= GALA_LIMIT) return { status: 409, message: "Gala dinner tickets are sold out." };
  if (existing) return { status: 409, message: "This email has already been used to book a ticket." };
  return null;
}

/**
 * Serialises purchases that compete for the same cap. Inside a transaction we bump a small
 * lock document for every cap this purchase touches; two concurrent purchases for the same
 * cap then write-conflict, MongoDB aborts one, and withTransaction retries it after the other
 * commits, so the re-count it sees is always up to date. (Count-then-insert without this
 * oversold Standard+2 by 66 tickets in the load test.)
 */
function saleLockKeys({ ticketType, subType, wantsGala, email }) {
  const keys = new Set(["email:" + String(email || "").toLowerCase()]);
  const overall = overallRule(ticketType);
  const internal = internalRule(subType, ticketType);
  if (overall) keys.add(overall.key);
  if (internal) keys.add(internal.key);
  if (wantsGala) keys.add("gala");
  return [...keys].sort();
}

async function acquireSaleLocks(args, session) {
  const locks = mongoose.connection.db.collection("salelocks");
  for (const key of saleLockKeys(args)) {
    await locks.updateOne({ _id: key }, { $inc: { v: 1 } }, { upsert: true, session });
  }
}

module.exports = { checkTicketLimits, acquireSaleLocks, saleLockKeys, escapeRegex, GALA_LIMIT };
