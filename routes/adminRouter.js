const express = require("express");
const router = express.Router();
const Abstract  = require("../models/abstractModel.js");
const UserTicket = require("../models/userModel.js"); 
const { sendTicketApprovalEmail, sendTicketRejectionEmail } = require("../utils/emailService.js");
const path = require("path");
const fs = require("fs");

// Handle OPTIONS requests for admin routes
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// GET ALL TICKETS for ADMIN dashboard

router.get("/getalltickets", async (req, res) => {
  try {
    // Assuming your model is named UserTicket
    const tickets = await UserTicket.find()
      .sort({ createdAt: -1 }) // latest tickets first
      .lean();

    // Map tickets to include all detailed information
    const processedTickets = tickets.map(ticket => ({
      _id: ticket._id,
      ticketType: ticket.ticketType,
      ticketCategory: ticket.ticketCategory,
      subType: ticket.subType,
      fullName: ticket.fullName,
      email: ticket.email,
      whatsapp: ticket.whatsapp,
      dashboardPassword: ticket.dashboardPassword,
      workshopPackage: ticket.workshopPackage,
      paymentStatus: ticket.paymentStatus,
      headshotUrl: ticket.headshotUrl || null,
      paymentProofUrl: ticket.paymentProofUrl || null,
      universityName: ticket.universityName,
      semester: ticket.semester,
      medicalQualification: ticket.medicalQualification,
      specialty: ticket.specialty,
      currentWorkplace: ticket.currentWorkplace,
      countryOfPractice: ticket.countryOfPractice,
      nationality: ticket.nationality,
      countryOfResidence: ticket.countryOfResidence,
      passportNumber: ticket.passportNumber,
      needsVisaSupport: ticket.needsVisaSupport,
      emergencyContactName: ticket.emergencyContactName,
      emergencyContactRelationship: ticket.emergencyContactRelationship,
      emergencyContactPhone: ticket.emergencyContactPhone,
      foodPreference: ticket.foodPreference,
      dietaryRestrictions: ticket.dietaryRestrictions,
      accessibilityNeeds: ticket.accessibilityNeeds,
      isTsuStudent: ticket.isTsuStudent,
      tsuEmail: ticket.tsuEmail,
      isGimsocMember: ticket.isGimsocMember,
      membershipCode: ticket.membershipCode,
      infoAccurate: ticket.infoAccurate,
      mediaConsent: ticket.mediaConsent,
      policies: ticket.policies,
      emailConsent: ticket.emailConsent,
      whatsappConsent: ticket.whatsappConsent,
      paymentMethod: ticket.paymentMethod,
      discountConfirmation: ticket.discountConfirmation,
      attendees: ticket.attendees?.map(att => ({
        name: att.name,
        email: att.email,
        headshotUrl: att.headshotUrl || null,
      })) || [],
      createdAt: ticket.createdAt,
    }));

    return res.status(200).json(processedTickets);
  } catch (err) {
    console.error("Error fetching tickets for admin:", err);
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
});

// Note: Files are now stored in Cloudinary, not local storage

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

    // Send email based on status
    if (paymentStatus === "completed") {
      try {
        await sendTicketApprovalEmail({
          fullName: ticket.fullName,
          email: ticket.email,
          ticketType: ticket.ticketType,
          ticketCategory: ticket.ticketCategory,
        });
        console.log("✅ Approval email sent successfully to:", ticket.email);
      } catch (emailError) {
        console.error("❌ Failed to send approval email:", emailError);
      }
    } else if (paymentStatus === "rejected") {
      try {
        await sendTicketRejectionEmail({
          fullName: ticket.fullName,
          email: ticket.email,
          ticketType: ticket.ticketType,
          ticketCategory: ticket.ticketCategory,
        });
        console.log("✅ Rejection email sent successfully to:", ticket.email);
      } catch (emailError) {
        console.error("❌ Failed to send rejection email:", emailError);
      }
    }

    return res.status(200).json({ message: "Ticket status updated successfully", ticket });
  } catch (error) {
    console.error("Error updating ticket status:", error);
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