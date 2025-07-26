const express = require("express");
const router = express.Router();
const axios = require("axios");
require("dotenv").config();

// Generate access token from PayPal
async function generateAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${process.env.PAYPAL_API}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
}


router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    console.log("🔍 Creating PayPal order with amount:", amount);

    if (!amount || isNaN(amount)) {
      console.log("❌ Invalid amount provided:", amount);
      return res.status(400).json({ error: "Invalid or missing amount" });
    }

    // Check if PayPal credentials are configured
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.log("❌ PayPal credentials not configured");
      return res.status(500).json({ error: "PayPal credentials not configured" });
    }

    const accessToken = await generateAccessToken();
    console.log("✅ PayPal access token generated");

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toString(),
          },
        },
      ],
    };

    console.log("🔍 Creating order with data:", orderData);

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      orderData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ PayPal order created successfully:", response.data.id);
    res.json({ id: response.data.id });
  } catch (error) {
    console.error("❌ Error creating PayPal order:", error.response?.data || error.message);
    console.error("❌ Error details:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    res.status(500).json({ 
      error: "Failed to create PayPal order", 
      details: error.response?.data || error.message 
    });
  }
});



router.post("/capture-order/:orderID", async (req, res) => {
  const { orderID } = req.params;

  try {
    const accessToken = await generateAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error capturing order:", error);
    res.status(500).json({ error: "Failed to capture PayPal order" });
  }
});

module.exports = router;