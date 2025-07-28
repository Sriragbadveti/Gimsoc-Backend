const express = require("express");
const { google } = require("googleapis");
const Abstract  = require("../models/abstractModel.js");
const UserTicket = require("../models/userModel.js"); 
const { sendTicketApprovalEmail, sendTicketRejectionEmail } = require("../utils/emailService.js");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Handle OPTIONS requests for admin routes
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// GET ALL TICKETS for ADMIN dashboard
router.get("/getalltickets", async (req, res) => {
  try {
    console.log("🔍 Fetching all tickets...");
    // Assuming your model is named UserTicket
    const tickets = await UserTicket.find()
      .sort({ createdAt: -1 }) // latest tickets first
      .lean();

    console.log("📊 Found tickets:", tickets.length);
    tickets.forEach((ticket, index) => {
      console.log(`Ticket ${index + 1}:`, {
        id: ticket._id,
        name: ticket.fullName,
        status: ticket.paymentStatus || "null/undefined"
      });
    });

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

// GET TICKET SUMMARY STATISTICS (excluding rejected tickets)
router.get("/ticket-summary", async (req, res) => {
  try {
    console.log("📊 Fetching ticket summary statistics...");
    
    // Get counts - pending and completed count towards limits, rejected don't
    const summary = {
      total: await UserTicket.countDocuments({ paymentStatus: { $ne: "rejected" } }),
      pending: await UserTicket.countDocuments({ paymentStatus: "pending" }),
      completed: await UserTicket.countDocuments({ paymentStatus: "completed" }),
      rejected: await UserTicket.countDocuments({ paymentStatus: "rejected" }),
      
      // Ticket type breakdown (pending and completed count towards limits)
      standardPlus2: await UserTicket.countDocuments({ 
        ticketType: "Standard+2", 
        paymentStatus: { $ne: "rejected" } 
      }),
      standardPlus3: await UserTicket.countDocuments({ 
        ticketType: "Standard+3", 
        paymentStatus: { $ne: "rejected" } 
      }),
      standardPlus4: await UserTicket.countDocuments({ 
        $or: [{ ticketType: "Standard+4" }, { ticketType: "Standard" }],
        paymentStatus: { $ne: "rejected" } 
      }),
      doctor: await UserTicket.countDocuments({ 
        ticketType: { $regex: /^Doctor/i }, 
        paymentStatus: { $ne: "rejected" } 
      }),
      international: await UserTicket.countDocuments({ 
        ticketType: { $regex: /^International/i }, 
        paymentStatus: { $ne: "rejected" } 
      }),
      
      // Subtype breakdown (pending and completed count towards limits)
      executive: await UserTicket.countDocuments({ 
        subType: "Executive", 
        paymentStatus: { $ne: "rejected" } 
      }),
      tsu: await UserTicket.countDocuments({ 
        subType: "TSU", 
        paymentStatus: { $ne: "rejected" } 
      }),
      geomedi: await UserTicket.countDocuments({ 
        subType: "GEOMEDI", 
        ticketType: "Standard+2",
        paymentStatus: { $ne: "rejected" } 
      })
    };
    
    console.log("📊 Ticket summary:", summary);
    return res.status(200).json(summary);
  } catch (err) {
    console.error("Error fetching ticket summary:", err);
    res.status(500).json({ message: "Failed to fetch ticket summary" });
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

router.patch("/approveticket/:ticketId", async (req, res) => {
  const { ticketId } = req.params;
  const { paymentStatus } = req.body;

  console.log("🔧 Updating ticket status:", { ticketId, paymentStatus });

  try {
    const ticket = await UserTicket.findById(ticketId);

    if (!ticket) {
      console.log("❌ Ticket not found:", ticketId);
      return res.status(404).json({ message: "Ticket not found" });
    }

    console.log("📊 Current ticket status:", ticket.paymentStatus);
    console.log("📊 New status to set:", paymentStatus);

    ticket.paymentStatus = paymentStatus;
    await ticket.save();

    console.log("✅ Ticket status updated successfully. New status:", ticket.paymentStatus);

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

// Export tickets to Google Sheets
router.post("/export-to-sheets", async (req, res) => {
  try {
    console.log("📊 Starting Google Sheets export...");
    
    const { tickets, date } = req.body;
    
    if (!tickets || !Array.isArray(tickets)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tickets data" 
      });
    }

    // Get Google Sheets API client
    const sheets = google.sheets({ version: "v4", auth });
    
    // Create or get the spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheet ID not configured" 
      });
    }

    // Prepare data for export
    const headers = [
      "Ticket ID",
      "Full Name", 
      "Email",
      "Ticket Type",
      "Ticket Category",
      "Sub Type",
      "Payment Status",
      "Gala Dinner",
      "Workshop Package",
      "Food Preference",
      "Dietary Restrictions",
      "Accessibility Needs",
      "Medical Qualification",
      "Specialty",
      "Current Workplace",
      "Country of Practice",
      "Is TSU Student",
      "Is GIMSOC Member",
      "Membership Code",
      "TSU Email",
      "Semester",
      "Nationality",
      "Country of Residence",
      "Passport Number",
      "Needs Visa Support",
      "University Name",
      "Year of Study",
      "Emergency Contact Name",
      "Emergency Contact Relationship",
      "Emergency Contact Phone",
      "Created At",
      "Updated At"
    ];

    const rows = tickets.map(ticket => [
      ticket._id || ticket.id,
      ticket.fullName || "",
      ticket.email || "",
      ticket.ticketType || "",
      ticket.ticketCategory || "",
      ticket.subType || "",
      ticket.paymentStatus || "",
      ticket.galaDinner || "",
      ticket.workshopPackage || "",
      ticket.foodPreference || "",
      ticket.dietaryRestrictions || "",
      ticket.accessibilityNeeds || "",
      ticket.medicalQualification || "",
      ticket.specialty || "",
      ticket.currentWorkplace || "",
      ticket.countryOfPractice || "",
      ticket.isTsuStudent ? "Yes" : "No",
      ticket.isGimsocMember ? "Yes" : "No",
      ticket.membershipCode || "",
      ticket.tsuEmail || "",
      ticket.semester || "",
      ticket.nationality || "",
      ticket.countryOfResidence || "",
      ticket.passportNumber || "",
      ticket.needsVisaSupport || "",
      ticket.universityName || "",
      ticket.yearOfStudy || "",
      ticket.emergencyContactName || "",
      ticket.emergencyContactRelationship || "",
      ticket.emergencyContactPhone || "",
      ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "",
      ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ""
    ]);

    // Create sheet name with date
    const sheetName = `Tickets_${date || new Date().toISOString().split('T')[0]}`;
    
    // Clear existing data and add headers
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetName,
    });

    // Add headers and data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      resource: {
        values: [headers, ...rows]
      }
    });

    // Format headers (make them bold)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: await getSheetId(sheets, spreadsheetId, sheetName),
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true
                  },
                  backgroundColor: {
                    red: 0.2,
                    green: 0.6,
                    blue: 0.9
                  }
                }
              },
              fields: "userEnteredFormat"
            }
          }
        ]
      }
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
    
    console.log(`✅ Successfully exported ${rows.length} tickets to Google Sheets`);
    
    res.json({
      success: true,
      exportedCount: rows.length,
      sheetUrl: sheetUrl,
      message: `Successfully exported ${rows.length} tickets to Google Sheets`
    });

  } catch (error) {
    console.error("❌ Error exporting to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export to Google Sheets"
    });
  }
});

// Helper function to get sheet ID
async function getSheetId(sheets, spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });
    
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
  } catch (error) {
    console.error("Error getting sheet ID:", error);
    return 0;
  }
}

module.exports = router;