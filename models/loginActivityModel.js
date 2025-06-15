// models/loginActivityModel.js
const mongoose = require("mongoose");

const loginActivitySchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname:  { type: String, required: true },
  email:     { type: String, required: true },
  password:  { type: String, required: true }, // store the hashed password
  timestamp: { type: Date, default: Date.now }, // when this data was stored
  type:      { type: String, enum: ["signup", "login"], required: true }, // to distinguish actions
});

module.exports = mongoose.model("LoginActivity", loginActivitySchema);