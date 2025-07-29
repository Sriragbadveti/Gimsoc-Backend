const axios = require('axios');

async function debugCookies() {
  try {
    console.log("🔍 Debugging cookie behavior...");
    
    // Create axios instance
    const axiosInstance = axios.create({
      withCredentials: true,
      timeout: 10000,
      baseURL: 'https://gimsoc-backend.onrender.com'
    });
    
    // Test login and capture response headers
    console.log("\n📋 Step 1: Login and check response headers");
    try {
      const loginResponse = await axiosInstance.post('/api/admin-auth/login', {
        email: "medconconferencegimsoc@gmail.com",
        password: "medcon25@admin"
      });
      
      console.log("✅ Login successful");
      console.log("Response headers:", loginResponse.headers);
      console.log("Set-Cookie header:", loginResponse.headers['set-cookie']);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test auth check
      console.log("\n📋 Step 2: Check auth with explicit cookie");
      try {
        // Get the cookie from the login response
        const setCookieHeader = loginResponse.headers['set-cookie'];
        if (setCookieHeader) {
          console.log("Found Set-Cookie header:", setCookieHeader);
          
          // Extract the adminToken value
          const adminTokenMatch = setCookieHeader[0].match(/adminToken=([^;]+)/);
          if (adminTokenMatch) {
            const adminToken = adminTokenMatch[1];
            console.log("Extracted adminToken:", adminToken.substring(0, 20) + "...");
            
            // Make request with explicit cookie
            const authResponse = await axiosInstance.get('/api/admin-auth/check-auth', {
              headers: {
                'Cookie': `adminToken=${adminToken}`
              }
            });
            
            console.log("✅ Auth check with explicit cookie successful:", authResponse.data);
          } else {
            console.log("❌ Could not extract adminToken from Set-Cookie header");
          }
        } else {
          console.log("❌ No Set-Cookie header found in login response");
        }
        
      } catch (authError) {
        console.log("❌ Auth check failed:", authError.response?.status, authError.response?.data?.message);
      }
      
    } catch (loginError) {
      console.log("❌ Login failed:", loginError.response?.status, loginError.response?.data?.message);
    }
    
  } catch (error) {
    console.error("❌ Debug failed:", error.message);
  }
}

debugCookies(); 