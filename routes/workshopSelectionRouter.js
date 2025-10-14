const express = require("express");
const router = express.Router();
const WorkshopSession = require("../models/workshopSessionModel.js");
const WorkshopSelection = require("../models/workshopSelectionModel.js");
const UserTicket = require("../models/userModel.js");
const adminAuthMiddleware = require("../middlewares/adminAuthMiddleware.js");

// Utility: get venue by ticket
function getVenueByTicket(ticketType) {
  if (ticketType === "Standard+2") return "TSU";
  if (ticketType === "Standard+3" || ticketType === "Standard+4") return "NVU";
  return null;
}

// GET sessions for a user (by email)
router.get("/sessions", async (req, res) => {
  try {
    const email = (req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await UserTicket.findOne({ email }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.paymentStatus || user.paymentStatus !== "completed") {
      return res.status(403).json({ message: "Ticket not approved" });
    }

    const venue = getVenueByTicket(user.ticketType);
    if (!venue) return res.status(400).json({ message: "Workshops not available for this ticket" });

    const sessions = await WorkshopSession.find({ venue }).sort({ day: 1, slot: 1, code: 1 }).lean();
    const selection = await WorkshopSelection.findOne({ email }).lean();
    return res.json({ sessions, selection, user: { ticketType: user.ticketType, email: user.email } });
  } catch (err) {
    console.error("GET /workshops/sessions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST selection (atomic validation + seat reservation)
router.post("/select", async (req, res) => {
  const session = await WorkshopSession.startSession();
  session.startTransaction();
  try {
    const { email, selections } = req.body;
    if (!email || !Array.isArray(selections)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "email and selections[] are required" });
    }
    const emailLower = email.toLowerCase().trim();

    const user = await UserTicket.findOne({ email: { $regex: new RegExp(`^${emailLower}$`, 'i') }, paymentStatus: "completed" }).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Approved ticket not found for email" });
    }

    const ticketType = user.ticketType;
    const venue = getVenueByTicket(ticketType);
    if (!venue) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Workshops not available for this ticket" });
    }

    // Load sessions map
    const sessionsDocs = await WorkshopSession.find({ code: { $in: selections }, venue }).session(session);
    if (sessionsDocs.length !== selections.length) {
      await session.abortTransaction();
      return res.status(400).json({ message: "One or more selections are invalid" });
    }

    // Validate per spec
    const byDaySlot = new Map();
    const linkedChosen = new Set();
    const dayCount = new Map(); // Track workshops per day

    for (const s of sessionsDocs) {
      const key = `${s.day}-${s.slot}`;
      if (byDaySlot.has(key)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "You've already chosen a workshop in this time slot." });
      }
      byDaySlot.set(key, true);

      // Count workshops per day
      dayCount.set(s.day, (dayCount.get(s.day) || 0) + 1);

      if (venue === "NVU" && s.linkedGroup) {
        if (linkedChosen.has(s.linkedGroup)) {
          await session.abortTransaction();
          return res.status(400).json({ message: "This session is linked with another — please select only one." });
        }
        linkedChosen.add(s.linkedGroup);
      }

      if (s.reserved >= s.capacity) {
        await session.abortTransaction();
        return res.status(409).json({ message: "Sorry, this session is full.", code: s.code });
      }
    }

    // General validation rules (applies to all ticket types)
    const day1 = dayCount.get(1) || 0;
    const day2 = dayCount.get(2) || 0;
    const totalWorkshops = day1 + day2;
    
    // 1. Max 3 workshops total
    if (totalWorkshops > 3) {
      await session.abortTransaction();
      return res.status(400).json({ message: "You can select a maximum of 3 workshops total." });
    }

    // 2. Min 1 workshop per day (both days must have at least 1)
    if (day1 < 1 || day2 < 1) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Please select at least 1 workshop for each day." });
    }

    // 3. Max 2 workshops per day
    if (day1 > 2 || day2 > 2) {
      await session.abortTransaction();
      return res.status(400).json({ message: "You can select a maximum of 2 workshops per day." });
    }

    // Upsert selection (enforce one per attendee)
    const existing = await WorkshopSelection.findOne({ email: emailLower }).session(session);
    // Release previously reserved seats if reselecting
    if (existing) {
      const prevSessions = await WorkshopSession.find({ code: { $in: existing.selections } }).session(session);
      for (const ps of prevSessions) {
        ps.reserved = Math.max(0, ps.reserved - 1);
        await ps.save({ session });
      }
    }

    // Reserve new seats
    for (const s of sessionsDocs) {
      s.reserved += 1;
      await s.save({ session });
    }

    const selDoc = await WorkshopSelection.findOneAndUpdate(
      { email: emailLower },
      { 
        email: emailLower,
        ticketType,
        venue,
        selections,
        day1Count: day1,
        day2Count: day2,
      },
      { upsert: true, new: true, session }
    );

    await session.commitTransaction();
    return res.json({ message: "Selection saved", selection: selDoc });
  } catch (err) {
    console.error("POST /workshops/select error:", err);
    try { await session.abortTransaction(); } catch (_) {}
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
});

module.exports = router;

// Admin: list selections with user and session details
router.get("/admin/list", adminAuthMiddleware, async (req, res) => {
  try {
    const selections = await WorkshopSelection.find({}).lean();
    const emails = selections.map(s => s.email);
    const users = await UserTicket.find({ email: { $in: emails } }).select("email fullName ticketType ticketCategory").lean();
    const emailToUser = new Map(users.map(u => [u.email.toLowerCase(), u]));

    // Fetch all session docs referenced
    const allCodes = Array.from(new Set(selections.flatMap(s => s.selections || [])));
    const sessions = await WorkshopSession.find({ code: { $in: allCodes } }).lean();
    const codeToSession = new Map(sessions.map(s => [s.code, s]));

    const data = selections.map(sel => ({
      email: sel.email,
      ticketType: sel.ticketType,
      venue: sel.venue,
      day1Count: sel.day1Count,
      day2Count: sel.day2Count,
      selections: (sel.selections || []).map(code => codeToSession.get(code) || { code }),
      user: emailToUser.get(sel.email.toLowerCase()) || null,
      createdAt: sel.createdAt,
      updatedAt: sel.updatedAt,
    }));

    return res.json({ count: data.length, data });
  } catch (err) {
    console.error("GET /workshops/admin/list error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


