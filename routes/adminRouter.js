const express = require("express");
const router = express.Router();
const Abstract  = require("../models/abstractModel.js");
const UserTicket = require("../models/userModel.js"); 
// GET ALL TICKETS for ADMIN dashboard

router.get("/getalltickets", async (req, res) => {
  try {
    // Assuming your model is named UserTicket
    const tickets = await UserTicket.find()
      .sort({ createdAt: -1 }) // latest tickets first
      .lean();

    // Optional: Map tickets to include file URLs if you store only paths
    const processedTickets = tickets.map(ticket => ({
      _id: ticket._id,
      ticketType: ticket.ticketType,
      fullName: ticket.fullName,
      email: ticket.email,
      workshopPackage: ticket.workshopPackage,
      paymentStatus: ticket.paymentStatus,
      headshotUrl: ticket.headshotUrl
        ? new URL(ticket.headshotUrl.startsWith("/uploads") ? ticket.headshotUrl : `/uploads/${ticket.headshotUrl}`, process.env.BASE_URL).href
        : null,
      paymentProofUrl: ticket.paymentProofUrl
        ? new URL(ticket.paymentProofUrl.startsWith("/uploads") ? ticket.paymentProofUrl : `/uploads/${ticket.paymentProofUrl}`, process.env.BASE_URL).href
        : null,
      attendees: ticket.attendees?.map(att => ({
        name: att.name,
        email: att.email,
        headshotUrl: att.headshotUrl
          ? new URL(att.headshotUrl.startsWith("/uploads") ? att.headshotUrl : `/uploads/${att.headshotUrl}`, process.env.BASE_URL).href
          : null,
      })) || [],
      createdAt: ticket.createdAt,
    }));

    return res.status(200).json(processedTickets);
  } catch (err) {
    console.error("Error fetching tickets for admin:", err);
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
});


router.patch("/approveticket/:ticketId",  async (req, res) => {
  const { ticketId } = req.params;
  const { paymentStatus } = req.body;

  try {
    const ticket = await UserTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.paymentStatus = paymentStatus;
    await ticket.save();

    return res.status(200).json({ message: "Ticket approved successfully", ticket });
  } catch (error) {
    console.error("Error approving ticket:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// ✅ NEW: GET ALL ABSTRACT SUBMISSIONS
router.get("/getallabstracts", async (req, res) => {
  try {
    const abstracts = await Abstract.find().sort({ createdAt: -1 }).lean();

    const processedAbstracts = abstracts.map((abs) => ({
      _id: abs._id,
      fullName: abs.fullName,
      email: abs.email,
      whatsapp: abs.whatsapp,
      title: abs.title,
      category: abs.category,
      authors: abs.authors,
      presentingAuthor: abs.presentingAuthor,
      isPresentingAuthorSame: abs.isPresentingAuthorSame,
      hasTicket: abs.hasTicket,
      ticketId: abs.ticketId || null,
      abstractFileURL: abs.abstractFileURL ? new URL(abs.abstractFileURL, process.env.BASE_URL).href : null,
      originalityConsent: abs.originalityConsent,
      disqualificationConsent: abs.disqualificationConsent,
      permissionConsent: abs.permissionConsent,
      createdAt: abs.createdAt,
    }));

    res.status(200).json(processedAbstracts);
  } catch (err) {
    console.error("Error fetching abstracts:", err);
    res.status(500).json({ message: "Failed to fetch abstracts" });
  }
});



module.exports = router;