const mongoose = require("mongoose");

const workshopSessionSchema = new mongoose.Schema({
  // Metadata
  code: { type: String, required: true, unique: true }, // e.g., TSU-D1-A-FOR-SUT, NVU-N1A
  venue: { type: String, enum: ["TSU", "NVU"], required: true },
  day: { type: Number, enum: [1, 2], required: true },
  slot: { type: String, enum: ["A", "B", "C", "D"], required: true },
  title: { type: String, required: true },
  time: { type: String, required: true }, // e.g., "2:00 PM – 3:30 PM"

  // Capacity & state
  capacity: { type: Number, required: true, default: 40 },
  reserved: { type: Number, required: true, default: 0 },

  // Mutual exclusion grouping (for NVU)
  linkedGroup: { type: String, default: null }, // e.g., "N1", "N2", "N3"
  room: { type: String, default: null }, // internal mapping (Room 1..6)
}, { timestamps: true });

workshopSessionSchema.index({ venue: 1, day: 1, slot: 1 });

module.exports = mongoose.model("WorkshopSession", workshopSessionSchema);





