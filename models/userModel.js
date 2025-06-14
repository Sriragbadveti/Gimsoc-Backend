const mongoose = require("mongoose");

const attendeeSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  whatsapp: String,
  university: String,
  semester: String,
  examPrep: String,
  examOther: String,
  headshotUrl: String,
  foodPreference: String,
  dietaryRestrictions: String,
  accessibilityNeeds: String,
  isGimsocMember: Boolean,
  membershipCode: String,
  infoAccurate: Boolean,
  mediaConsent: Boolean,
  policies: Boolean,
  emailConsent: Boolean,
  whatsappConsent: Boolean,
});

const userTicketSchema = new mongoose.Schema({
  ticketType: {
    type: String,
    enum: [
      "Doctor",
      "Individual",
      "Group",
      "TSU",
      "TSU All Inclusive",
      "All Inclusive",
      "International",
    ],
    
  },
  email: { type: String,required: function () {
    return this.ticketType !== "Group"; // Only required if not group
  }, },
  whatsapp: { type: String },
  password:{type:String },
  workshopPackage: String,
  headshotUrl: String,
  foodPreference: String,
  dietaryRestrictions: String,
  accessibilityNeeds: String,
  paymentMethod: String,
  paymentProofUrl: String,
  discountConfirmation: Boolean,
  infoAccurate: Boolean,
  mediaConsent: Boolean,
  policies: Boolean,
  emailConsent: Boolean,
  whatsappConsent: Boolean,

  // Doctor / Individual / International etc:
  fullName: String,
  medicalQualification: String,
  specialty: String,
  currentWorkplace: String,
  countryOfPractice: String,

  // TSU:
  isTsuStudent: Boolean,
  tsuEmail: String,
  semester: String,

  // International:
  nationality: String,
  countryOfResidence: String,
  passportNumber: String,
  needsVisaSupport: String,
  universityName: String,
  yearOfStudy: String,
  emergencyContactName: String,
  emergencyContactRelationship: String,
  emergencyContactPhone: String,
  studentIdProofUrl: String,

  // Group Tickets
  attendees: [attendeeSchema],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("UserTicket", userTicketSchema);