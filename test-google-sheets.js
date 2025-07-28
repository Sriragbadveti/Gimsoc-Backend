require("dotenv").config();
const { google } = require("googleapis");

// Test Google Sheets API connection
async function testGoogleSheets() {
  try {
    console.log("🔍 Testing Google Sheets API connection...");
    
    // Check environment variables
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!keyPath) {
      console.error("❌ GOOGLE_SERVICE_ACCOUNT_KEY_PATH not set in .env");
      return;
    }
    
    if (!sheetId) {
      console.error("❌ GOOGLE_SHEET_ID not set in .env");
      return;
    }
    
    console.log("✅ Environment variables found");
    console.log("📁 Key file path:", keyPath);
    console.log("📊 Sheet ID:", sheetId);
    
    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    // Get Google Sheets client
    const sheets = google.sheets({ version: "v4", auth });
    
    // Test reading the sheet
    console.log("📖 Testing sheet access...");
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    
    console.log("✅ Successfully connected to Google Sheets!");
    console.log("📋 Sheet title:", response.data.properties.title);
    console.log("📊 Number of sheets:", response.data.sheets.length);
    
    // Test writing to sheet
    console.log("✍️ Testing write access...");
    const testData = [
      ["Test", "Connection", "Successful"],
      ["Timestamp", new Date().toISOString(), "✅"]
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      resource: {
        values: testData
      }
    });
    
    console.log("✅ Successfully wrote test data to sheet!");
    console.log("🎉 Google Sheets API setup is working correctly!");
    
  } catch (error) {
    console.error("❌ Error testing Google Sheets API:", error.message);
    
    if (error.code === 403) {
      console.error("💡 Make sure you've shared the sheet with your service account email");
    }
    
    if (error.code === 404) {
      console.error("💡 Check that your GOOGLE_SHEET_ID is correct");
    }
  }
}

testGoogleSheets(); 