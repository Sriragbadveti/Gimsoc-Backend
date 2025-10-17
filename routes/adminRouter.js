const express = require("express");
const { google } = require("googleapis");
const Abstract  = require("../models/abstractModel.js");
const UserTicket = require("../models/userModel.js"); 
const WorkshopSelection = require("../models/workshopSelectionModel.js");
const { sendTicketApprovalEmail, sendTicketRejectionEmail } = require("../utils/emailService.js");
const { adminAuthMiddleware } = require("../middlewares/adminAuthMiddleware.js");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose"); // Added for system status
const VolunteerApplication = require("../models/volunteerModel.js");

const router = express.Router();

// Specific middleware for handling large payloads in admin routes
router.use(express.json({ limit: '100mb' }));
router.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Handle OPTIONS requests for admin routes with enhanced CORS
router.options('*', (req, res) => {
  const origin = req.headers.origin || 'https://www.medcongimsoc.com';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Google Sheets API setup
let auth;
if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  // Use base64 encoded credentials from environment variable
  const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
} else {
  // Use key file (for local development)
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Test endpoint for debugging
router.get("/test-sheets", async (req, res) => {
  try {
    console.log("🧪 Testing Google Sheets connection...");
    
    // Test environment variables
    console.log("🔑 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64 exists:", !!process.env.GOOGLE_CREDENTIALS_BASE64);
    console.log("- GOOGLE_SHEET_ID exists:", !!process.env.GOOGLE_SHEET_ID);
    
    if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
      return res.status(500).json({ error: "GOOGLE_CREDENTIALS_BASE64 not found" });
    }
    
    if (!process.env.GOOGLE_SHEET_ID) {
      return res.status(500).json({ error: "GOOGLE_SHEET_ID not found" });
    }
    
    // Test credentials parsing
    try {
      const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
      console.log("✅ Credentials parsed successfully");
      console.log("- Client email:", credentials.client_email);
    } catch (parseError) {
      console.error("❌ Failed to parse credentials:", parseError);
      return res.status(500).json({ error: "Failed to parse credentials: " + parseError.message });
    }
    
    // Test Google Sheets API connection
    const sheets = google.sheets({ version: "v4", auth });
    
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID
      });
      console.log("✅ Successfully connected to Google Sheets");
      console.log("- Spreadsheet title:", response.data.properties.title);
      console.log("- Number of sheets:", response.data.sheets.length);
      
      res.json({
        success: true,
        message: "Google Sheets connection successful",
        spreadsheetTitle: response.data.properties.title,
        sheetCount: response.data.sheets.length
      });
    } catch (sheetsError) {
      console.error("❌ Google Sheets API error:", sheetsError);
      return res.status(500).json({ 
        error: "Google Sheets API error: " + sheetsError.message,
        details: sheetsError.response?.data || sheetsError
      });
    }
    
  } catch (error) {
    console.error("❌ Test endpoint error:", error);
    res.status(500).json({ error: "Test failed: " + error.message });
  }
});

// GET ALL TICKETS for ADMIN dashboard
router.get("/getalltickets", adminAuthMiddleware, async (req, res) => {
  try {
    // Silent fetch - only log on errors
    // Assuming your model is named UserTicket
    const tickets = await UserTicket.find()
      .sort({ createdAt: -1 }) // latest tickets first
      .lean();

    // Silent processing - no individual ticket logging

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
      // nationality: ticket.nationality,
      // countryOfResidence: ticket.countryOfResidence,
      // passportNumber: ticket.passportNumber,
      // needsVisaSupport: ticket.needsVisaSupport,
      emergencyContactName: ticket.emergencyContactName,
      emergencyContactRelationship: ticket.emergencyContactRelationship,
      emergencyContactPhone: ticket.emergencyContactPhone,
      foodPreference: ticket.foodPreference,
      dietaryRestrictions: ticket.dietaryRestrictions,
      accessibilityNeeds: ticket.accessibilityNeeds,
      galaDinner: ticket.galaDinner,
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
      // paypalOrderId: ticket.paypalOrderId, // Add PayPal order ID for international tickets
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
router.get("/ticket-summary", adminAuthMiddleware, async (req, res) => {
  try {
    // Silent fetch - only log on errors
    
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
      online: await UserTicket.countDocuments({ 
        ticketType: "Online", 
        paymentStatus: { $ne: "rejected" } 
      }),
      basic: await UserTicket.countDocuments({ 
        ticketType: "Basic", 
        paymentStatus: { $ne: "rejected" } 
      }),
      // international: await UserTicket.countDocuments({ 
      //   ticketType: { $regex: /^International/i }, 
      //   paymentStatus: { $ne: "rejected" } 
      // }),
      
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
      }),
      
      // Gala dinner counts (including automatic inclusions for all-inclusive doctor tickets)
      galaTickets: await UserTicket.countDocuments({ 
        galaDinner: { $regex: /Yes/i },
        paymentStatus: { $ne: "rejected" } 
      }),
      galaLimit: 150,
      
      // Gala Access ticket counts (separate from dinner tickets)
      galaAccessTickets: await UserTicket.countDocuments({ 
        ticketType: "Gala Add-On",
        paymentStatus: { $ne: "rejected" } 
      }),
      galaAccessLimit: 100
    };
    
    // Silent response - no summary logging
    return res.status(200).json(summary);
  } catch (err) {
    console.error("Error fetching ticket summary:", err);
    res.status(500).json({ message: "Failed to fetch ticket summary" });
  }
});

// Note: Files are now stored in Cloudinary, not local storage

// Test endpoint to check file URLs in database
router.get("/file-urls", adminAuthMiddleware, async (req, res) => {
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

router.patch("/approveticket/:ticketId", adminAuthMiddleware, async (req, res) => {
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

// DELETE TICKET endpoint
router.delete("/deleteticket/:ticketId", adminAuthMiddleware, async (req, res) => {
  const { ticketId } = req.params;

  console.log("🗑️ Deleting ticket:", ticketId);

  try {
    const ticket = await UserTicket.findById(ticketId);

    if (!ticket) {
      console.log("❌ Ticket not found:", ticketId);
      return res.status(404).json({ message: "Ticket not found" });
    }

    console.log("📊 Deleting ticket:", { 
      fullName: ticket.fullName, 
      email: ticket.email, 
      ticketType: ticket.ticketType 
    });

    // Delete the ticket from database
    await UserTicket.findByIdAndDelete(ticketId);

    console.log("✅ Ticket deleted successfully:", ticketId);

    return res.status(200).json({ 
      message: "Ticket deleted successfully", 
      deletedTicket: {
        id: ticketId,
        fullName: ticket.fullName,
        ticketType: ticket.ticketType
      }
    });
  } catch (error) {
    console.error("❌ Error deleting ticket:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ NEW: GET ALL ABSTRACT SUBMITTIONS
router.get("/getallabstracts", adminAuthMiddleware, async (req, res) => {
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
router.post("/export-to-sheets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Starting Google Sheets export...");
    console.log("🔍 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64:", process.env.GOOGLE_CREDENTIALS_BASE64 ? "Set" : "Not set");
    console.log("- GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID || "Not set");
    
    // Check request size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
      console.log("❌ Request too large:", contentLength, "bytes");
      return res.status(413).json({ 
        success: false, 
        message: "Request payload too large. Please try with fewer tickets or contact support." 
      });
    }
    
    const { tickets, date } = req.body;
    
    if (!tickets || !Array.isArray(tickets)) {
      console.log("❌ Invalid tickets data received");
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tickets data" 
      });
    }

    console.log(`📋 Processing ${tickets.length} tickets...`);
    
    // Check if tickets array is too large
    if (tickets.length > 10000) {
      console.log("❌ Too many tickets:", tickets.length);
      return res.status(413).json({ 
        success: false, 
        message: "Too many tickets to export at once. Please try with fewer tickets." 
      });
    }

    // Test auth setup
    console.log("🔐 Testing authentication...");
    let auth;
    try {
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("🔐 Using base64 credentials...");
        const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.log("🔐 Using key file...");
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      }
      console.log("✅ Authentication setup successful");
    } catch (authError) {
      console.error("❌ Authentication setup failed:", authError);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication setup failed: " + authError.message 
      });
    }

    // Get Google Sheets API client
    console.log("📊 Initializing Google Sheets client...");
    const sheets = google.sheets({ version: "v4", auth });
    
    // Create or get the spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheet ID not configured" 
      });
    }

    // Filter out rejected tickets
    const validTickets = tickets.filter(ticket => ticket.paymentStatus !== "rejected");
    console.log(`📊 Filtered tickets: ${validTickets.length} valid out of ${tickets.length} total`);
    
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

    const rows = validTickets.map(ticket => [
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
    // Create valid sheet name (replace hyphens with underscores)
    const rawDate = date || new Date().toISOString().split('T')[0];
    const sheetName = `Tickets_${rawDate.replace(/-/g, '_')}`;
    console.log(`📊 Using sheet name: ${sheetName}`);
    
    try {
      // First, check if the sheet exists
      console.log("🔍 Checking if sheet exists...");
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId
      });
      
      const sheetExists = spreadsheetInfo.data.sheets.some(sheet => 
        sheet.properties.title === sheetName
      );
      
      if (!sheetExists) {
        console.log("📄 Sheet doesn't exist, creating new sheet...");
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });
        console.log("✅ New sheet created successfully");
      } else {
        console.log("✅ Sheet already exists");
      }
      
      // Clear existing data and add headers
      console.log("🧹 Clearing existing data...");
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });
      console.log("✅ Data cleared successfully");

      // Add headers and data
      console.log("📝 Writing data to sheet...");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [headers, ...rows]
        }
      });
      console.log("✅ Data written successfully");
    } catch (sheetError) {
      console.error("❌ Sheet operation failed:", sheetError);
      console.error("❌ Error details:", {
        message: sheetError.message,
        code: sheetError.code,
        status: sheetError.status,
        response: sheetError.response?.data
      });
      return res.status(500).json({ 
        success: false, 
        message: "Sheet operation failed: " + sheetError.message,
        details: {
          code: sheetError.code,
          status: sheetError.status,
          response: sheetError.response?.data
        }
      });
    }

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
    const specificSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1`;
    
    console.log(`✅ Successfully exported ${rows.length} valid tickets to Google Sheets`);
    console.log(`📊 Sheet URL: ${sheetUrl}`);
    console.log(`📊 Sheet name: ${sheetName}`);
    console.log(`📊 Data range: A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`);
    
    res.json({
      success: true,
      exportedCount: rows.length,
      totalTickets: tickets.length,
      validTickets: validTickets.length,
      rejectedTickets: tickets.length - validTickets.length,
      sheetUrl: sheetUrl,
      specificSheetUrl: specificSheetUrl,
      sheetName: sheetName,
      dataRange: `A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`,
      message: `Successfully exported ${rows.length} valid tickets to Google Sheets in sheet '${sheetName}' (excluded ${tickets.length - validTickets.length} rejected tickets)`
    });

  } catch (error) {
    console.error("❌ Error exporting to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export to Google Sheets"
    });
  }
});

// System status endpoint
router.get("/system-status", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    
    const status = {
      timestamp: new Date().toISOString(),
      emailQueue: {
        pending: await emailQueue.getQueueLength(),
        processing: emailQueue.isProcessing()
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error("Error getting system status:", error);
    res.status(500).json({ error: "Failed to get system status" });
  }
});

// Export volunteers to Google Sheets
router.post("/export-volunteers-to-sheets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Starting volunteer Google Sheets export...");
    console.log("🔍 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64:", process.env.GOOGLE_CREDENTIALS_BASE64 ? "Set" : "Not set");
    console.log("- GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID || "Not set");
    
    const { volunteers, date } = req.body;
    
    if (!volunteers || !Array.isArray(volunteers)) {
      console.log("❌ Invalid volunteers data received");
      return res.status(400).json({ 
        success: false, 
        message: "Invalid volunteers data" 
      });
    }

    console.log(`📋 Processing ${volunteers.length} volunteers...`);
    
    // Check if volunteers array is too large
    if (volunteers.length > 10000) {
      console.log("❌ Too many volunteers:", volunteers.length);
      return res.status(413).json({ 
        success: false, 
        message: "Too many volunteers to export at once. Please try with fewer volunteers." 
      });
    }

    // Test auth setup
    console.log("🔐 Testing authentication...");
    let auth;
    try {
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("🔐 Using base64 credentials...");
        const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.log("🔐 Using key file...");
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      }
      console.log("✅ Authentication setup successful");
    } catch (authError) {
      console.error("❌ Authentication setup failed:", authError);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication setup failed: " + authError.message 
      });
    }

    // Get Google Sheets API client
    console.log("📊 Initializing Google Sheets client...");
    const sheets = google.sheets({ version: "v4", auth });
    
    // Create or get the spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheet ID not configured" 
      });
    }

    // Prepare data for export
    const headers = [
      "Volunteer ID",
      "Full Name", 
      "Email",
      "WhatsApp Number",
      "University",
      "Is GIMSOC Member",
      "GIMSOC Membership ID",
      "Date of Arrival",
      "Date of Departure",
      "First Choice Team",
      "Second Choice Team",
      "Third Choice Team",
      "What Makes You Unique",
      "Handle Constructive Criticism",
      "Logistics Responses",
      "PR & Marketing Responses",
      "Organization Responses",
      "Workshop Responses",
      "Registration Responses",
      "IT & Tech Support Responses",
      "Source",
      "Created At",
      "Updated At"
    ];

    const rows = volunteers.map(volunteer => [
      volunteer._id || volunteer.id,
      volunteer.fullName || "",
      volunteer.email || "",
      volunteer.whatsappNumber || "",
      volunteer.university || "",
      volunteer.isGimsocMember ? "Yes" : "No",
      volunteer.gimsocMembershipId || "",
      volunteer.dateOfArrival ? new Date(volunteer.dateOfArrival).toLocaleDateString() : "",
      volunteer.dateOfDeparture ? new Date(volunteer.dateOfDeparture).toLocaleDateString() : "",
      volunteer.firstChoice || "",
      volunteer.secondChoice || "",
      volunteer.thirdChoice || "",
      volunteer.whatMakesYouUnique || "",
      volunteer.handleConstructiveCriticism || "",
      volunteer.logisticsResponses ? JSON.stringify(volunteer.logisticsResponses) : "",
      volunteer.prMarketingResponses ? JSON.stringify(volunteer.prMarketingResponses) : "",
      volunteer.organizationResponses ? JSON.stringify(volunteer.organizationResponses) : "",
      volunteer.workshopResponses ? JSON.stringify(volunteer.workshopResponses) : "",
      volunteer.registrationResponses ? JSON.stringify(volunteer.registrationResponses) : "",
      volunteer.itTechResponses ? JSON.stringify(volunteer.itTechResponses) : "",
      volunteer.source || "",
      volunteer.createdAt ? new Date(volunteer.createdAt).toLocaleString() : "",
      volunteer.updatedAt ? new Date(volunteer.updatedAt).toLocaleString() : ""
    ]);

    // Create sheet name with date
    const rawDate = date || new Date().toISOString().split('T')[0];
    const sheetName = `Volunteers_${rawDate.replace(/-/g, '_')}`;
    console.log(`📊 Using sheet name: ${sheetName}`);
    
    try {
      // First, check if the sheet exists
      console.log("🔍 Checking if sheet exists...");
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId
      });
      
      const sheetExists = spreadsheetInfo.data.sheets.some(sheet => 
        sheet.properties.title === sheetName
      );
      
      if (!sheetExists) {
        console.log("📄 Sheet doesn't exist, creating new sheet...");
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });
        console.log("✅ New sheet created successfully");
      } else {
        console.log("✅ Sheet already exists");
      }
      
      // Clear existing data and add headers
      console.log("🧹 Clearing existing data...");
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });
      console.log("✅ Data cleared successfully");

      // Add headers and data
      console.log("📝 Writing data to sheet...");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [headers, ...rows]
        }
      });
      console.log("✅ Data written successfully");
    } catch (sheetError) {
      console.error("❌ Sheet operation failed:", sheetError);
      console.error("❌ Error details:", {
        message: sheetError.message,
        code: sheetError.code,
        status: sheetError.status,
        response: sheetError.response?.data
      });
      return res.status(500).json({ 
        success: false, 
        message: "Sheet operation failed: " + sheetError.message,
        details: {
          code: sheetError.code,
          status: sheetError.status,
          response: sheetError.response?.data
        }
      });
    }

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
    const specificSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1`;
    
    console.log(`✅ Successfully exported ${rows.length} volunteers to Google Sheets`);
    console.log(`📊 Sheet URL: ${sheetUrl}`);
    console.log(`📊 Sheet name: ${sheetName}`);
    console.log(`📊 Data range: A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`);
    
    res.json({
      success: true,
      exportedCount: rows.length,
      totalVolunteers: volunteers.length,
      sheetUrl: sheetUrl,
      specificSheetUrl: specificSheetUrl,
      sheetName: sheetName,
      dataRange: `A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`,
      message: `Successfully exported ${rows.length} volunteers to Google Sheets in sheet '${sheetName}'`
    });

  } catch (error) {
    console.error("❌ Error exporting volunteers to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export volunteers to Google Sheets"
    });
  }
});

// Clear email queue endpoint
router.post("/clear-email-queue", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    const clearedCount = emailQueue.clearQueue();
    
    res.json({
      message: "Email queue cleared successfully",
      clearedCount: clearedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error clearing email queue:", error);
    res.status(500).json({ error: "Failed to clear email queue" });
  }
});

// ✅ NEW: GET ALL VOLUNTEER APPLICATIONS
router.get("/getallvolunteers", adminAuthMiddleware, async (req, res) => {
  try {
    const volunteers = await VolunteerApplication.find()
      .sort({ createdAt: -1 })
      .lean();

    const processed = volunteers.map((v) => ({
      _id: v._id,
      fullName: v.fullName,
      email: v.email,
      whatsappNumber: v.whatsappNumber,
      university: v.university,
      isGimsocMember: v.isGimsocMember,
      gimsocMembershipId: v.gimsocMembershipId || null,
      dateOfArrival: v.dateOfArrival,
      dateOfDeparture: v.dateOfDeparture,
      firstChoice: v.firstChoice,
      secondChoice: v.secondChoice,
      thirdChoice: v.thirdChoice,
      whatMakesYouUnique: v.whatMakesYouUnique,
      handleConstructiveCriticism: v.handleConstructiveCriticism,
      logisticsResponses: v.logisticsResponses || null,
      prMarketingResponses: v.prMarketingResponses || null,
      organizationResponses: v.organizationResponses || null,
      workshopResponses: v.workshopResponses || null,
      registrationResponses: v.registrationResponses || null,
      itTechResponses: v.itTechResponses || null,
      createdAt: v.createdAt,
    }));

    res.status(200).json(processed);
  } catch (err) {
    console.error("Error fetching volunteers:", err);
    res.status(500).json({ message: "Failed to fetch volunteers" });
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

// Export workshop registrations to Google Sheets
router.post("/export-workshops-to-sheets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Starting workshop registrations Google Sheets export...");
    console.log("🔍 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64:", process.env.GOOGLE_CREDENTIALS_BASE64 ? "Set" : "Not set");
    console.log("- GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID || "Not set");
    
    const { workshopRegistrations, date } = req.body;
    
    if (!workshopRegistrations || !Array.isArray(workshopRegistrations)) {
      console.log("❌ Invalid workshop registrations data received");
      return res.status(400).json({ 
        success: false, 
        message: "Invalid workshop registrations data" 
      });
    }

    console.log(`📋 Processing ${workshopRegistrations.length} workshop registrations...`);
    
    // Check if registrations array is too large
    if (workshopRegistrations.length > 10000) {
      console.log("❌ Too many registrations:", workshopRegistrations.length);
      return res.status(413).json({ 
        success: false, 
        message: "Too many registrations to export at once. Please try with fewer registrations." 
      });
    }

    // Test auth setup
    console.log("🔐 Testing authentication...");
    let auth;
    try {
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("🔐 Using base64 credentials...");
        const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.log("🔐 Using key file...");
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      }
      console.log("✅ Authentication setup successful");
    } catch (authError) {
      console.error("❌ Authentication setup failed:", authError);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication setup failed: " + authError.message 
      });
    }

    // Get Google Sheets API client
    console.log("📊 Initializing Google Sheets client...");
    const sheets = google.sheets({ version: "v4", auth });
    
    // Create or get the spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheet ID not configured" 
      });
    }

    // Prepare data for export
    const headers = [
      "Registration ID",
      "Workshop ID",
      "Workshop Title",
      "Full Name",
      "Email",
      "WhatsApp",
      "University",
      "Other University",
      "Current Semester",
      "Status",
      "Registration Date",
      "Created At",
      "Updated At"
    ];

    const rows = workshopRegistrations.map(registration => [
      registration._id || registration.id,
      registration.workshopId || "",
      registration.workshopTitle || "",
      registration.fullName || "",
      registration.email || "",
      registration.whatsapp || "",
      registration.university || "",
      registration.otherUniversity || "",
      registration.currentSemester || "",
      registration.status || "",
      registration.registrationDate ? new Date(registration.registrationDate).toLocaleDateString() : "",
      registration.createdAt ? new Date(registration.createdAt).toLocaleString() : "",
      registration.updatedAt ? new Date(registration.updatedAt).toLocaleString() : ""
    ]);

    // Create sheet name with date
    const rawDate = date || new Date().toISOString().split('T')[0];
    const sheetName = `Workshop_Registrations_${rawDate.replace(/-/g, '_')}`;
    console.log(`📊 Using sheet name: ${sheetName}`);
    
    try {
      // First, check if the sheet exists
      console.log("🔍 Checking if sheet exists...");
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId
      });
      
      const sheetExists = spreadsheetInfo.data.sheets.some(sheet => 
        sheet.properties.title === sheetName
      );
      
      if (!sheetExists) {
        console.log("📄 Sheet doesn't exist, creating new sheet...");
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });
        console.log("✅ New sheet created successfully");
      } else {
        console.log("✅ Sheet already exists");
      }
      
      // Clear existing data and add headers
      console.log("🧹 Clearing existing data...");
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });
      console.log("✅ Data cleared successfully");

      // Add headers and data
      console.log("📝 Writing data to sheet...");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [headers, ...rows]
        }
      });
      console.log("✅ Data written successfully");
    } catch (sheetError) {
      console.error("❌ Sheet operation failed:", sheetError);
      console.error("❌ Error details:", {
        message: sheetError.message,
        code: sheetError.code,
        status: sheetError.status,
        response: sheetError.response?.data
      });
      return res.status(500).json({ 
        success: false, 
        message: "Sheet operation failed: " + sheetError.message,
        details: {
          code: sheetError.code,
          status: sheetError.status,
          response: sheetError.response?.data
        }
      });
    }

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
    const specificSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1`;
    
    console.log(`✅ Successfully exported ${rows.length} workshop registrations to Google Sheets`);
    console.log(`📊 Sheet URL: ${sheetUrl}`);
    console.log(`📊 Sheet name: ${sheetName}`);
    console.log(`📊 Data range: A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`);
    
    res.json({
      success: true,
      exportedCount: rows.length,
      totalRegistrations: workshopRegistrations.length,
      sheetUrl: sheetUrl,
      specificSheetUrl: specificSheetUrl,
      sheetName: sheetName,
      dataRange: `A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`,
      message: `Successfully exported ${rows.length} workshop registrations to Google Sheets in sheet '${sheetName}'`
    });

  } catch (error) {
    console.error("❌ Error exporting workshop registrations to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export workshop registrations to Google Sheets"
    });
  }
});

// Export workshop selections to Google Sheets
router.post("/export-workshop-selections-to-sheets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Starting workshop selections Google Sheets export...");
    console.log("🔍 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64:", process.env.GOOGLE_CREDENTIALS_BASE64 ? "Set" : "Not set");
    console.log("- GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID || "Not set");
    
    const { date } = req.body;
    
    console.log("📊 Fetching workshop selections from database...");
    const workshopSelections = await WorkshopSelection.find({})
      .populate('user', 'fullName email')
      .sort({ updatedAt: -1 });
    
    console.log(`📊 Found ${workshopSelections.length} workshop selections for export`);

    // Test auth setup
    console.log("🔐 Testing authentication...");
    let auth;
    try {
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("🔐 Using base64 credentials...");
        const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.log("🔐 Using key file...");
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      }
      console.log("✅ Authentication setup successful");
    } catch (authError) {
      console.error("❌ Authentication setup failed:", authError);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication setup failed: " + authError.message 
      });
    }

    // Get Google Sheets API client
    console.log("📊 Initializing Google Sheets client...");
    const sheets = google.sheets({ version: "v4", auth });
    
    // Create or get the spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheet ID not configured" 
      });
    }

    const sheetName = `Workshop Selections ${date || new Date().toISOString().split('T')[0]}`;

    console.log(`📊 Using spreadsheet ID: ${spreadsheetId}`);
    console.log(`📊 Creating sheet: ${sheetName}`);

    // Create new sheet for workshop selections
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 20
                }
              }
            }
          }]
        }
      });
      console.log(`✅ Created new sheet: ${sheetName}`);
    } catch (sheetError) {
      if (sheetError.message && sheetError.message.includes('already exists')) {
        console.log(`📊 Sheet ${sheetName} already exists, will overwrite data`);
        // Clear existing data
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A:Z`
        });
      } else {
        throw sheetError;
      }
    }

    // Prepare headers
    const headers = [
      'Email',
      'Full Name',
      'Ticket Type',
      'Venue',
      'Day 1 Count',
      'Day 2 Count',
      'Total Workshops',
      'Workshop Details',
      'Selection Date',
      'Updated Date'
    ];

    // Prepare data rows
    const rows = workshopSelections.map((selection) => {
      const workshopDetails = (selection.selections || []).map(workshop => 
        `${workshop.code} - ${workshop.title} (Day ${workshop.day}, Slot ${workshop.slot}, ${workshop.time})`
      ).join(' | ');
      
      return [
        selection.email || '',
        selection.user?.fullName || '',
        selection.ticketType || '',
        selection.venue || '',
        selection.day1Count || 0,
        selection.day2Count || 0,
        (selection.selections || []).length,
        workshopDetails,
        selection.createdAt ? new Date(selection.createdAt).toLocaleString() : '',
        selection.updatedAt ? new Date(selection.updatedAt).toLocaleString() : ''
      ];
    });

    console.log(`📊 Prepared ${rows.length} rows for export`);

    // Add headers and data to the sheet
    const values = [headers, ...rows];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values
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
    const specificSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1`;
    
    console.log(`✅ Successfully exported ${rows.length} workshop selections to Google Sheets`);
    console.log(`📊 Sheet URL: ${sheetUrl}`);
    console.log(`📊 Sheet name: ${sheetName}`);
    console.log(`📊 Data range: A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`);
    
    res.json({
      success: true,
      exportedCount: rows.length,
      totalSelections: workshopSelections.length,
      sheetUrl: sheetUrl,
      specificSheetUrl: specificSheetUrl,
      sheetName: sheetName,
      dataRange: `A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`,
      message: `Successfully exported ${rows.length} workshop selections to Google Sheets in sheet '${sheetName}'`
    });

  } catch (error) {
    console.error("❌ Error exporting workshop selections to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export workshop selections to Google Sheets"
    });
  }
});

// Export abstracts to Google Sheets
router.post("/export-abstracts-to-sheets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Starting abstracts Google Sheets export...");
    
    // Check environment variables
    console.log("- GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID || "Not set");
    
    if (!process.env.GOOGLE_SHEET_ID) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false,
        message: "Google Sheet ID not configured" 
      });
    }

    // Get all abstracts
    console.log("📊 Fetching abstracts from database...");
    const abstracts = await Abstract.find({}).sort({ submittedAt: -1 });
    console.log(`📊 Found ${abstracts.length} abstracts`);

    if (abstracts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No abstracts found to export"
      });
    }

    // Test auth setup
    console.log("🔐 Testing authentication...");
    let auth;
    try {
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("🔐 Using base64 credentials...");
        const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.log("🔐 Using key file...");
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      }
      console.log("✅ Authentication setup successful");
    } catch (authError) {
      console.error("❌ Authentication setup failed:", authError);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication setup failed: " + authError.message 
      });
    }

    // Get Google Sheets API client
    console.log("📊 Initializing Google Sheets client...");
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false,
        message: "Google Sheet ID not configured" 
      });
    }

    // Prepare data for export
    console.log("📊 Preparing abstracts data for export...");
    // Create valid sheet name (replace hyphens with underscores)
    const rawDate = new Date().toISOString().split('T')[0];
    const sheetName = `Abstracts_${rawDate.replace(/-/g, '_')}`;
    console.log(`📊 Using sheet name: ${sheetName}`);
    
    try {
      // First, check if the sheet exists
      console.log("🔍 Checking if sheet exists...");
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId
      });
      
      const sheetExists = spreadsheetInfo.data.sheets.some(sheet => 
        sheet.properties.title === sheetName
      );
      
      if (!sheetExists) {
        console.log("📄 Sheet doesn't exist, creating new sheet...");
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });
        console.log("✅ New sheet created successfully");
      } else {
        console.log("✅ Sheet already exists");
      }
      
      // Clear existing data and add headers
      console.log("🧹 Clearing existing data...");
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });
      console.log("✅ Data cleared successfully");

    } catch (sheetError) {
      console.error("❌ Error managing sheet:", sheetError);
      return res.status(500).json({
        success: false,
        message: "Failed to manage sheet: " + sheetError.message
      });
    }
    
    // Define headers
    const headers = [
      "Full Name",
      "Email", 
      "WhatsApp",
      "Title",
      "Category",
      "Authors",
      "Presenting Author",
      "Abstract File URL",
      "Originality Consent",
      "Disqualification Consent", 
      "Permission Consent",
      "Submitted At"
    ];

    // Prepare rows
    const rows = abstracts.map(abstract => [
      abstract.fullName || "",
      abstract.email || "",
      abstract.whatsapp || "",
      abstract.title || "",
      abstract.category || "",
      abstract.authors || "",
      abstract.presentingAuthor || "",
      abstract.abstractFileURL || "",
      abstract.originalityConsent ? "Yes" : "No",
      abstract.disqualificationConsent ? "Yes" : "No", 
      abstract.permissionConsent ? "Yes" : "No",
      abstract.submittedAt ? new Date(abstract.submittedAt).toLocaleString() : ""
    ]);

    // Add headers as first row
    const allRows = [headers, ...rows];

    console.log(`📊 Preparing to write ${allRows.length} rows to Google Sheets...`);

    // Write data to Google Sheets
    console.log("📝 Writing data to sheet...");
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      resource: {
        values: allRows
      }
    });
    console.log("✅ Data written successfully");

    // Auto-resize columns
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          requests: [{
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length
              }
            }
          }]
        }
      });
    } catch (resizeError) {
      console.log("⚠️ Could not auto-resize columns:", resizeError.message);
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
    const specificSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1`;

    console.log(`✅ Successfully exported ${rows.length} abstracts to Google Sheets`);

    res.json({
      success: true,
      message: `Successfully exported ${rows.length} abstracts to Google Sheets in sheet '${sheetName}'`,
      data: {
        count: rows.length,
        sheetUrl: sheetUrl,
        specificSheetUrl: specificSheetUrl,
        sheetName: sheetName
      }
    });

  } catch (error) {
    console.error("❌ Error exporting abstracts to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export abstracts to Google Sheets"
    });
  }
});

// Migrate workshop payment status for existing registrations
router.post("/migrate-workshop-payment-status", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("🔄 Starting workshop payment status migration...");
    
    const WorkshopRegistration = require("../models/workshopModel.js");
    const UserTicket = require("../models/userModel.js");

    // Get all scientific-series workshop registrations
    const scientificSeriesRegistrations = await WorkshopRegistration.find({
      workshopId: 'scientific-series'
    });

    console.log(`📋 Found ${scientificSeriesRegistrations.length} scientific series registrations to process`);

    let updatedCount = 0;
    let freeAccessCount = 0;
    let paidAccessCount = 0;

    for (const registration of scientificSeriesRegistrations) {
      let needsUpdate = false;
      const updateData = {};

      // Check if user has a valid MEDCON ticket
      const hasValidTicket = await UserTicket.findOne({
        email: registration.email.toLowerCase().trim(),
        paymentStatus: { $ne: "rejected" }
      }).lean();

      if (hasValidTicket) {
        // User has MEDCON ticket - should be free access
        if (registration.selectedScientificSeries !== 'Free Access - MEDCON Ticket Holder') {
          updateData.selectedScientificSeries = 'Free Access - MEDCON Ticket Holder';
          needsUpdate = true;
        }
        
        if (!registration.feeWaived) {
          updateData.feeWaived = true;
          needsUpdate = true;
        }
        
        if (registration.paymentRequired !== false) {
          updateData.paymentRequired = false;
          needsUpdate = true;
        }
        
        if (registration.paymentStatus !== 'n/a') {
          updateData.paymentStatus = 'n/a';
          needsUpdate = true;
        }

        freeAccessCount++;
      } else {
        // User doesn't have MEDCON ticket - should be paid access
        if (!registration.selectedScientificSeries || registration.selectedScientificSeries === 'Free Access - MEDCON Ticket Holder') {
          // Determine payment category based on GIMSOC membership if available
          const paymentCategory = registration.isGimsocMember === 'Yes' 
            ? '5 GEL / 175 INR – GIMSOC Member'
            : '7 GEL / 240 INR – Non-Member';
          updateData.selectedScientificSeries = paymentCategory;
          needsUpdate = true;
        }
        
        if (registration.feeWaived !== false) {
          updateData.feeWaived = false;
          needsUpdate = true;
        }
        
        if (registration.paymentRequired !== true) {
          updateData.paymentRequired = true;
          needsUpdate = true;
        }
        
        if (registration.paymentStatus !== 'pending') {
          updateData.paymentStatus = 'pending';
          needsUpdate = true;
        }

        paidAccessCount++;
      }

      // Update the registration if needed
      if (needsUpdate) {
        await WorkshopRegistration.findByIdAndUpdate(
          registration._id,
          updateData,
          { new: true }
        );
        
        updatedCount++;
        console.log(`✅ Updated registration for ${registration.email}: ${hasValidTicket ? 'FREE (MEDCON)' : 'PAID'}`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total registrations processed: ${scientificSeriesRegistrations.length}`);
    console.log(`   Records updated: ${updatedCount}`);
    console.log(`   Free access (MEDCON holders): ${freeAccessCount}`);
    console.log(`   Paid access (Non-MEDCON): ${paidAccessCount}`);
    
    console.log('\n✅ Workshop payment status migration completed successfully!');

    res.json({
      success: true,
      message: "Workshop payment status migration completed successfully!",
      data: {
        totalProcessed: scientificSeriesRegistrations.length,
        recordsUpdated: updatedCount,
        freeAccessCount: freeAccessCount,
        paidAccessCount: paidAccessCount
      }
    });

  } catch (error) {
    console.error("❌ Migration error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to migrate workshop payment status"
    });
  }
});

module.exports = router;