require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔧 MEDCON Email System Environment Setup');
console.log('========================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

console.log(`📁 .env file: ${envExists ? '✅ Found' : '❌ Missing'}`);

if (!envExists) {
  console.log('\n⚠️ .env file not found. Please create one using .env.example as a template.');
  console.log('   Copy .env.example to .env and fill in your actual values.\n');
}

// Check critical environment variables
const criticalVars = [
  'RESEND_API_KEY',
  'MONGO_DB',
  'JWT_SECRET'
];

const optionalVars = [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'GOOGLE_CREDENTIALS_BASE64'
];

console.log('🔍 Environment Variables Check:');
console.log('================================');

console.log('\n📋 Critical Variables (Required for email system):');
criticalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const display = value ? (varName === 'RESEND_API_KEY' ? '[HIDDEN]' : value.substring(0, 20) + '...') : 'NOT SET';
  console.log(`   ${status} ${varName}: ${display}`);
});

console.log('\n📋 Optional Variables (Required for full functionality):');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️';
  const display = value ? '[SET]' : 'NOT SET';
  console.log(`   ${status} ${varName}: ${display}`);
});

// Check Resend API Key format
if (process.env.RESEND_API_KEY) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey.startsWith('re_')) {
    console.log('\n✅ Resend API Key format appears correct');
  } else {
    console.log('\n⚠️ Resend API Key format may be incorrect (should start with "re_")');
  }
} else {
  console.log('\n❌ Resend API Key is missing - this is the most likely cause of email failures');
}

// Test email service initialization
console.log('\n🧪 Testing Email Service Initialization:');
try {
  const { Resend } = require('resend');
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Email service initialized successfully');
  } else {
    console.log('❌ Cannot initialize email service without RESEND_API_KEY');
  }
} catch (error) {
  console.log('❌ Error initializing email service:', error.message);
}

// Database connection test
console.log('\n🗄️ Testing Database Connection:');
if (process.env.MONGO_DB) {
  console.log(`✅ MongoDB URL configured: ${process.env.MONGO_DB}`);
} else {
  console.log('❌ MongoDB URL not configured');
}

// Recommendations
console.log('\n💡 Recommendations:');
console.log('===================');

if (!process.env.RESEND_API_KEY) {
  console.log('1. 🚨 CRITICAL: Set up your Resend API key');
  console.log('   - Go to https://resend.com/api-keys');
  console.log('   - Create a new API key');
  console.log('   - Add it to your .env file as RESEND_API_KEY=re_your_key_here');
}

if (!envExists) {
  console.log('2. 📁 Create .env file from .env.example');
}

console.log('3. 🔄 Restart your application after making changes');
console.log('4. 📧 Use the admin endpoints to monitor email delivery:');
console.log('   - GET /api/admin/system-status - Check email queue status');
console.log('   - GET /api/admin/failed-emails - View failed emails');
console.log('   - POST /api/admin/retry-failed-emails - Retry failed emails');
console.log('   - POST /api/admin/test-email - Send test email');

console.log('\n🏁 Setup Complete!');
console.log('==================');

if (process.env.RESEND_API_KEY && envExists) {
  console.log('✅ Your environment appears to be configured correctly.');
  console.log('   If emails are still not being delivered, check the admin dashboard for failed emails.');
} else {
  console.log('⚠️ Your environment needs configuration before emails will work.');
  console.log('   Please address the issues above and run this script again.');
}