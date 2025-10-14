const mongoose = require("mongoose");

const workshopSelectionSchema = new mongoose.Schema({
  // Identify attendee by email (matches UserTicket email)
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  ticketType: { type: String, required: true }, // Standard+2, Standard+3, Standard+4
  venue: { type: String, enum: ["TSU", "NVU"], required: true },

  // Selected session codes
  selections: [{ type: String, required: true }],

  // Derived info for validation
  day1Count: { type: Number, default: 0 },
  day2Count: { type: Number, default: 0 },
}, { timestamps: true });

workshopSelectionSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("WorkshopSelection", workshopSelectionSchema);


