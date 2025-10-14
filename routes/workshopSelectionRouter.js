const express = require("express");
const router = express.Router();
const WorkshopSession = require("../models/workshopSessionModel.js");
const WorkshopSelection = require("../models/workshopSelectionModel.js");
const UserTicket = require("../models/userModel.js");
const { adminAuthMiddleware } = require("../middlewares/adminAuthMiddleware.js");
const { sendWorkshopConfirmationEmail } = require("../utils/emailService.js");

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

    // Ticket-specific validation rules
    const day1 = dayCount.get(1) || 0;
    const day2 = dayCount.get(2) || 0;
    const totalWorkshops = day1 + day2;
    
    if (ticketType === "Standard+2") {
      // Standard+2 (TSU): Exactly 1 workshop per day (2 total)
      if (day1 !== 1 || day2 !== 1) {
        await session.abortTransaction();
        return res.status(400).json({ message: "You must select exactly 1 workshop for each day (2 workshops total)." });
      }
    } else if (ticketType === "Standard+3" || ticketType === "Standard+4") {
      // Standard+3 & Standard+4 (NVU): 1-2 workshops per day (3 total max)
      if (totalWorkshops > 3) {
        await session.abortTransaction();
        return res.status(400).json({ message: "You can select a maximum of 3 workshops total." });
      }
      if (day1 < 1 || day2 < 1) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Please select at least 1 workshop for each day." });
      }
      if (day1 > 2 || day2 > 2) {
        await session.abortTransaction();
        return res.status(400).json({ message: "You can select a maximum of 2 workshops per day." });
      }
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
    
    // Send confirmation email asynchronously (don't block the response)
    setImmediate(async () => {
      try {
        const workshopsWithDetails = sessionsDocs.map(s => ({
          code: s.code,
          title: s.title,
          day: s.day,
          time: s.time,
          venue: s.venue,
          slot: s.slot
        }));

        await sendWorkshopConfirmationEmail(
          { 
            fullName: user.fullName || 'Attendee',
            email: emailLower 
          },
          workshopsWithDetails
        );
        console.log('✅ Workshop confirmation email sent to:', emailLower);
      } catch (emailError) {
        console.error('❌ Error sending workshop confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    });

    return res.json({ message: "Selection saved", selection: selDoc });
  } catch (err) {
    console.error("POST /workshops/select error:", err);
    try { await session.abortTransaction(); } catch (_) {}
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
});

// Admin: Seed workshop sessions
router.post("/admin/seed", adminAuthMiddleware, async (req, res) => {
  try {
    const defs = [];

    // TSU (Std+2)
    const TSU_A = { day: 1, slot: "A", time: "2:00 PM – 3:30 PM", venue: "TSU" };
    const TSU_B = { day: 1, slot: "B", time: "4:00 PM – 5:30 PM", venue: "TSU" };
    const TSU_C = { day: 2, slot: "C", time: "2:00 PM – 3:30 PM", venue: "TSU" };
    const TSU_D = { day: 2, slot: "D", time: "4:00 PM – 5:30 PM", venue: "TSU" };

    // T1 Foreign Object Removal + Suturing & Flap Closure
    defs.push({ code: "T1-A", title: "Foreign Object Removal + Suturing & Flap Closure", capacity: 40, reserved: 0, ...TSU_A });
    defs.push({ code: "T1-B", title: "Foreign Object Removal + Suturing & Flap Closure", capacity: 40, reserved: 0, ...TSU_B });
    defs.push({ code: "T1-C", title: "Foreign Object Removal + Suturing & Flap Closure", capacity: 40, reserved: 0, ...TSU_C });

    // T2 AMBOSS
    defs.push({ code: "T2-D", title: "AMBOSS: Bridging Textbooks & Clinics", capacity: 40, reserved: 0, ...TSU_D });

    // T3 Central Line Placement
    defs.push({ code: "T3-A", title: "Central Line Placement", capacity: 40, reserved: 0, ...TSU_A });
    defs.push({ code: "T3-B", title: "Central Line Placement", capacity: 40, reserved: 0, ...TSU_B });
    defs.push({ code: "T3-D", title: "Central Line Placement", capacity: 40, reserved: 0, ...TSU_D });

    // T4 Incision & Drainage
    defs.push({ code: "T4-A", title: "Incision & Drainage", capacity: 40, reserved: 0, ...TSU_A });
    defs.push({ code: "T4-C", title: "Incision & Drainage", capacity: 40, reserved: 0, ...TSU_C });
    defs.push({ code: "T4-D", title: "Incision & Drainage", capacity: 40, reserved: 0, ...TSU_D });

    // NVU (Std+3, Std+4)
    const NVU_A = { day: 1, slot: "A", time: "3:00 PM – 4:30 PM", venue: "NVU" };
    const NVU_B = { day: 1, slot: "B", time: "5:00 PM – 6:30 PM", venue: "NVU" };
    const NVU_C = { day: 2, slot: "C", time: "3:00 PM – 4:30 PM", venue: "NVU" };
    const NVU_D = { day: 2, slot: "D", time: "5:00 PM – 6:30 PM", venue: "NVU" };

    // N1A / N1B
    defs.push({ code: "N1A-A", title: "From Swab to Solution: STI Cultures", capacity: 40, reserved: 0, room: "Room 1", linkedGroup: "N1", ...NVU_A });
    defs.push({ code: "N1A-C", title: "From Swab to Solution: STI Cultures", capacity: 40, reserved: 0, room: "Room 1", linkedGroup: "N1", ...NVU_C });
    defs.push({ code: "N1B-B", title: "Nasal Swabbing & Respiratory Pathogen ID", capacity: 40, reserved: 0, room: "Room 1", linkedGroup: "N1", ...NVU_B });
    defs.push({ code: "N1B-D", title: "Nasal Swabbing & Respiratory Pathogen ID", capacity: 40, reserved: 0, room: "Room 1", linkedGroup: "N1", ...NVU_D });

    // N2A / N2B
    defs.push({ code: "N2A-A", title: "Wound Care & Drainage Management", capacity: 40, reserved: 0, room: "Room 2", linkedGroup: "N2", ...NVU_A });
    defs.push({ code: "N2A-C", title: "Wound Care & Drainage Management", capacity: 40, reserved: 0, room: "Room 2", linkedGroup: "N2", ...NVU_C });
    defs.push({ code: "N2B-B", title: "Wound Debridement & Suturing", capacity: 40, reserved: 0, room: "Room 2", linkedGroup: "N2", ...NVU_B });
    defs.push({ code: "N2B-D", title: "Wound Debridement & Suturing", capacity: 40, reserved: 0, room: "Room 2", linkedGroup: "N2", ...NVU_D });

    // N3 / N4
    defs.push({ code: "N3-A", title: "Outbreak Management Simulation", capacity: 40, reserved: 0, room: "Room 3", linkedGroup: "N3", ...NVU_A });
    defs.push({ code: "N3-C", title: "Outbreak Management Simulation", capacity: 40, reserved: 0, room: "Room 3", linkedGroup: "N3", ...NVU_C });
    defs.push({ code: "N4-B", title: "PPE Safety Practices & Critical Decision", capacity: 40, reserved: 0, room: "Room 4", linkedGroup: "N4", ...NVU_B });
    defs.push({ code: "N4-D", title: "PPE Safety Practices & Critical Decision", capacity: 40, reserved: 0, room: "Room 4", linkedGroup: "N4", ...NVU_D });

    // N5 / N6
    for (const slot of [NVU_A, NVU_B, NVU_C, NVU_D]) {
      const slotLabel = slot.slot;
      defs.push({ code: `N5-${slotLabel}`, title: "Endotracheal Intubation", capacity: 40, reserved: 0, room: "Room 5", ...slot });
      defs.push({ code: `N6-${slotLabel}`, title: "Venepuncture & Blood Culture Collection", capacity: 40, reserved: 0, room: "Room 6", ...slot });
    }

    // Upsert sessions
    for (const def of defs) {
      await WorkshopSession.findOneAndUpdate(
        { code: def.code },
        { $set: def },
        { upsert: true }
      );
    }

    return res.json({ message: "Workshop sessions seeded successfully", count: defs.length });
  } catch (err) {
    console.error("Seed workshops error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Admin: Delete a user's workshop selection
router.delete("/admin/delete/:email", adminAuthMiddleware, async (req, res) => {
  const session = await WorkshopSession.startSession();
  session.startTransaction();
  
  try {
    const email = req.params.email.toLowerCase().trim();
    
    if (!email) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the selection
    const selection = await WorkshopSelection.findOne({ email }).session(session);
    
    if (!selection) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Workshop selection not found for this user" });
    }

    // Release reserved seats
    if (selection.selections && selection.selections.length > 0) {
      const workshops = await WorkshopSession.find({ 
        code: { $in: selection.selections } 
      }).session(session);
      
      for (const workshop of workshops) {
        workshop.reserved = Math.max(0, workshop.reserved - 1);
        await workshop.save({ session });
      }
    }

    // Delete the selection
    await WorkshopSelection.deleteOne({ email }).session(session);
    
    await session.commitTransaction();
    
    console.log(`✅ Admin deleted workshop selection for: ${email}`);
    return res.json({ 
      message: "Workshop selection deleted successfully",
      email,
      releasedSeats: selection.selections.length
    });
    
  } catch (err) {
    console.error("DELETE /workshops/admin/delete error:", err);
    try { await session.abortTransaction(); } catch (_) {}
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
});

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

module.exports = router;

