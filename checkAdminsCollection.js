require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("./models/adminModel");

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

async function checkAdminsCollection() {
  try {
    console.log("🔍 Checking admins collection...");
    
    // Get all admins from the collection
    const admins = await Admin.find({}).lean();
    
    console.log(`📊 Found ${admins.length} admin(s) in the collection:`);
    
    if (admins.length === 0) {
      console.log("❌ No admins found in the collection");
      console.log("💡 You need to add the authorized admin emails");
    } else {
      admins.forEach((admin, index) => {
        console.log(`\n${index + 1}. Email: ${admin.email}`);
        console.log(`   Role: ${admin.role || 'Not set'}`);
        console.log(`   Active: ${admin.isActive !== false ? 'Yes' : 'No'}`);
        console.log(`   Created: ${admin.createdAt || 'Not set'}`);
        console.log(`   Has Password: ${admin.password ? 'Yes' : 'No'}`);
      });
    }
    
    // Check if our target emails exist
    const targetEmails = [
      "medconconferencegimsoc@gmail.com",
      "gunchashaikh11@gmail.com",
      "muhamadbarakat20@gmail.com",
      "nupuraajesh@gmail.com",
      "saja.mohamed.1@iliauni.edu.ge",
      "nikhilalizaby@gmail.com",
      "mennah.emam@gmail.com",
      "mandrika311@gmail.com"
    ];
    
    console.log("\n🎯 Checking for target emails:");
    const existingEmails = admins.map(admin => admin.email.toLowerCase());
    
    targetEmails.forEach(email => {
      const exists = existingEmails.includes(email.toLowerCase());
      console.log(`${exists ? '✅' : '❌'} ${email} ${exists ? '(exists)' : '(missing)'}`);
    });
    
    const missingEmails = targetEmails.filter(email => 
      !existingEmails.includes(email.toLowerCase())
    );
    
    if (missingEmails.length > 0) {
      console.log(`\n⚠️  Missing ${missingEmails.length} admin(s):`);
      missingEmails.forEach(email => console.log(`- ${email}`));
    } else {
      console.log("\n✅ All target emails are present!");
    }
    
  } catch (error) {
    console.error("❌ Error checking admins collection:", error);
  } finally {
    mongoose.connection.close();
  }
}

checkAdminsCollection(); 