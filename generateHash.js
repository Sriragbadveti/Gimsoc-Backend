const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = "medcon25@admin";
  const hashedPassword = await bcrypt.hash(password, 12);
  
  console.log("🔐 Password Hash Generated:");
  console.log("Original password:", password);
  console.log("Hashed password:", hashedPassword);
  console.log("\n📋 Use this hashed password for all admin users in MongoDB Compass:");
  console.log(hashedPassword);
}

generateHash(); 