const express = require("express");
const router = express.Router();
const Abstract  = require("../models/abstractModel.js");
const UserTicket = require("../models/userModel.js"); 
const path = require("path");
const fs = require("fs");

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
        ? ticket.headshotUrl.startsWith("http") 
          ? ticket.headshotUrl 
          : `${process.env.BASE_URL || "https://gimsoc-backend.onrender.com"}/uploads/${ticket.headshotUrl.replace(/^\/?uploads\//, "")}`
        : null,
      paymentProofUrl: ticket.paymentProofUrl
        ? ticket.paymentProofUrl.startsWith("http")
          ? ticket.paymentProofUrl
          : `${process.env.BASE_URL || "https://gimsoc-backend.onrender.com"}/uploads/${ticket.paymentProofUrl.replace(/^\/?uploads\//, "")}`
        : null,
      attendees: ticket.attendees?.map(att => ({
        name: att.name,
        email: att.email,
        headshotUrl: att.headshotUrl
          ? att.headshotUrl.startsWith("http")
            ? att.headshotUrl
            : `${process.env.BASE_URL || "https://gimsoc-backend.onrender.com"}/uploads/${att.headshotUrl.replace(/^\/?uploads\//, "")}`
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

// NEW: Download file endpoint
router.get("/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    console.log("Download request for filename:", filename);
    
    const filePath = path.join(__dirname, "../uploads", filename);
    console.log("Full file path:", filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log("File not found at path:", filePath);
      return res.status(404).json({ message: "File not found" });
    }
    
    console.log("File found, starting download...");
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://www.medcongimsoc.com');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ message: "Failed to download file" });
  }
});

// Test endpoint to list available files
router.get("/files", async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, "../uploads");
    const files = fs.readdirSync(uploadsDir);
    res.json({ files });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ message: "Failed to list files" });
  }
});

// Test endpoint to check file URLs in database
router.get("/file-urls", async (req, res) => {
  try {
    const tickets = await UserTicket.find({}, { headshotUrl: 1, paymentProofUrl: 1, fullName: 1 }).limit(5);
    const abstracts = await Abstract.find({}, { abstractFileURL: 1, title: 1 }).limit(5);
    
    res.json({ 
      tickets: tickets.map(t => ({ 
        fullName: t.fullName, 
        headshotUrl: t.headshotUrl, 
        paymentProofUrl: t.paymentProofUrl 
      })),
      abstracts: abstracts.map(a => ({ 
        title: a.title, 
        abstractFileURL: a.abstractFileURL 
      }))
    });
  } catch (error) {
    console.error("Error fetching file URLs:", error);
    res.status(500).json({ message: "Failed to fetch file URLs" });
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