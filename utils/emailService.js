const { Resend } = require('resend');
const QRCode = require('qrcode');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendTicketConfirmationEmail = async (userData) => {
  try {
    const { fullName, email, ticketType, ticketCategory, ticketId } = userData;
    
    // Generate QR code with ticket details
    const qrData = JSON.stringify({
      ticketId: ticketId,
      fullName: fullName,
      email: email,
      ticketType: ticketType,
      ticketCategory: ticketCategory,
      timestamp: new Date().toISOString()
    });
    
    // Generate QR code as base64 PNG for maximum email compatibility
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      type: 'image/png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('🔍 QR Code generated successfully, length:', qrCodeBase64.length);
    console.log('📋 QR Data:', qrData);
    console.log('📧 QR Code base64 starts with:', qrCodeBase64.substring(0, 50));
    
    // Create a simple text-based ticket display as fallback
    const ticketText = `
Ticket ID: ${ticketId}
Name: ${fullName}
Email: ${email}
Type: ${ticketType}
Category: ${ticketCategory}
    `.trim();
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MEDCON 2025 - Ticket Confirmation</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            margin: -30px -30px 30px -30px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .ticket-details {
            background-color: #f8f9fa;
            border-left: 4px solid #28a745;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .ticket-details h3 {
            margin: 0 0 15px 0;
            color: #28a745;
            font-size: 18px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #495057;
          }
          .detail-value {
            color: #6c757d;
          }
          .next-steps {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .next-steps h3 {
            margin: 0 0 15px 0;
            color: #2196f3;
            font-size: 18px;
          }
          .next-steps ul {
            margin: 0;
            padding-left: 20px;
          }
          .next-steps li {
            margin-bottom: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
          }
          .social-links {
            margin-top: 20px;
          }
          .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #667eea;
            text-decoration: none;
          }
          .social-links a:hover {
            text-decoration: underline;
          }
          .highlight {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
          }
          .highlight strong {
            color: #856404;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">🎉</div>
            <h1>Welcome to MEDCON 2025!</h1>
            <p>Your ticket has been successfully booked</p>
          </div>
          
          <p>Dear <strong>${fullName}</strong>,</p>
          
          <p>Thank you for registering for <strong>MEDCON 2025</strong>! We're thrilled to have you join us for this incredible medical conference experience.</p>
          
          <div class="ticket-details">
            <h3>📋 Ticket Details</h3>
            <div class="detail-row">
              <span class="detail-label">Ticket ID:</span>
              <span class="detail-value">${ticketId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ticket Type:</span>
              <span class="detail-value">${ticketType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">${ticketCategory}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Registration Email:</span>
              <span class="detail-value">${email}</span>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
            <h3 style="margin: 0 0 15px 0; color: #28a745;">🎫 Your Ticket QR Code</h3>
            <p style="margin: 0 0 20px 0; color: #6c757d; font-size: 14px;">
              Scan this QR code at the conference for quick check-in and access to your ticket details
            </p>
            <div style="display: inline-block; padding: 15px; background-color: white; border: 2px solid #28a745; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              <img src="${qrCodeBase64}" alt="Ticket QR Code" style="width: 200px; height: 200px; display: block; border: 1px solid #ddd;" />
            </div>
            <p style="margin: 15px 0 0 0; color: #6c757d; font-size: 12px;">
              <strong>Ticket ID:</strong> ${ticketId}
            </p>
            <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
              <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">📋 Ticket Details (Text Version)</h4>
              <pre style="margin: 0; font-family: monospace; font-size: 12px; color: #495057; white-space: pre-wrap;">${ticketText}</pre>
            </div>
            <p style="margin: 10px 0 0 0; color: #dc3545; font-size: 11px;">
              <strong>Note:</strong> If QR code doesn't display, please show your Ticket ID at check-in
            </p>
          </div>
          
          <div class="highlight">
            <strong>🎯 What's Next?</strong><br>
            We're excited to see you at MEDCON 2025! Keep an eye on your email for important updates, workshop selections, and conference details.
          </div>
          
          <div class="next-steps">
            <h3>📅 What to Expect</h3>
            <ul>
              <li><strong>Workshop Selection:</strong> You'll receive an email when workshop registration opens</li>
              <li><strong>Conference Schedule:</strong> Detailed schedule will be shared closer to the event</li>
              <li><strong>Venue Information:</strong> Location details and directions will be provided</li>
              <li><strong>Networking Opportunities:</strong> Connect with fellow medical professionals</li>
              <li><strong>Certificate:</strong> Receive your CPD certificate after the conference</li>
            </ul>
          </div>
          
          <p>We're counting down the days until MEDCON 2025! Get ready for an amazing experience filled with learning, networking, and unforgettable memories.</p>
          
          <p>If you have any questions, feel free to reach out to us at <strong>medconconferencegimsoc@gmail.com</strong></p>
          
          <div class="footer">
            <p><strong>MEDCON 2025</strong> - Organized by GIMSOC</p>
            <div class="social-links">
              <a href="https://www.medcongimsoc.com">Website</a> |
              <a href="mailto:medconconferencegimsoc@gmail.com">Contact Us</a>
            </div>
            <p style="margin-top: 15px; font-size: 12px; color: #adb5bd;">
              This is an automated confirmation email. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [email],
      subject: '🎉 Welcome to MEDCON 2025 - Your Ticket Confirmation',
      html: emailContent,
    });

    if (error) {
      console.error('❌ Email sending failed:', error);
      return { success: false, error };
    }

    console.log('✅ Confirmation email sent successfully to:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    return { success: false, error };
  }
};

module.exports = {
  sendTicketConfirmationEmail
}; 