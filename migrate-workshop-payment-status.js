const mongoose = require('mongoose');
const WorkshopRegistration = require('./models/workshopModel.js');
const UserTicket = require('./models/userModel.js');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gimsoc', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function to update existing workshop registrations
const migrateWorkshopPaymentStatus = async () => {
  try {
    console.log('🔄 Starting workshop payment status migration...');

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
          // Set a default paid option if none exists
          updateData.selectedScientificSeries = '7 GEL / 240 INR – Non-Member';
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
      } else {
        console.log(`ℹ️  No update needed for ${registration.email}: ${hasValidTicket ? 'FREE (MEDCON)' : 'PAID'}`);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total registrations processed: ${scientificSeriesRegistrations.length}`);
    console.log(`   Records updated: ${updatedCount}`);
    console.log(`   Free access (MEDCON holders): ${freeAccessCount}`);
    console.log(`   Paid access (Non-MEDCON): ${paidAccessCount}`);
    
    console.log('\n✅ Workshop payment status migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
};

// Main execution function
const runMigration = async () => {
  try {
    await connectDB();
    await migrateWorkshopPaymentStatus();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateWorkshopPaymentStatus };
