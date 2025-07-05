const mongoose = require("mongoose");

const userTicketSchema = new mongoose.Schema({
  // Required for classification
  ticketCategory: {
    type: String,
    enum: ["Standard", "All-Inclusive", "Doctor", "International", "Executive & Subcom"],
    required: true,
  },
  subType: {
    type: String,
    enum: ["GIMSOC", "Non-GIMSOC", "TSU", "3-Day", "7-Day", "Standard", "All-Inclusive", "Group"],
  },

  // Common User Info
  fullName: String,
  email: { type: String, required: true },
  whatsapp: String,
  password: String, // optional, if needed

  // Medical / Academic
  universityName: String,
  yearOfStudy: String,
  semester: String,
  medicalQualification: String,
  specialty: String,
  currentWorkplace: String,
  countryOfPractice: String,

  // International
  nationality: String,
  countryOfResidence: String,
  passportNumber: String,
  needsVisaSupport: String,
  emergencyContactName: String,
  emergencyContactRelationship: String,
  emergencyContactPhone: String,

  // Uploads
  headshotUrl: String,
  studentIdProofUrl: String,
  paymentProofUrl: String,

  // Preferences & Consent
  foodPreference: String,
  dietaryRestrictions: String,
  accessibilityNeeds: String,

  isTsuStudent: Boolean,
  tsuEmail: String,
  isGimsocMember: Boolean,
  membershipCode: String,

  infoAccurate: Boolean,
  mediaConsent: Boolean,
  policies: Boolean,
  emailConsent: Boolean,
  whatsappConsent: Boolean,

  // Payment
  paymentMethod: String,
  discountConfirmation: Boolean,
  workshopPackage: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("UserTicket", userTicketSchema);