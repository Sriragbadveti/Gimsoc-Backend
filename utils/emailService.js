const { TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo');
const QRManager = require('./qrManager');

// Initialize Brevo API
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(0, process.env.BREVO_API_KEY);

const qrManager = new QRManager();

const sendTicketConfirmationEmail = async (userData) => {
  try {
    const { fullName, email, ticketType, ticketCategory, ticketId } = userData;
    
    console.log('📧 Email service called with data:', {
      fullName,
      email,
      ticketType,
      ticketCategory,
      ticketId
    });
    
    if (!email) {
      console.error('❌ No email provided to email service');
      return { success: false, error: 'No email provided' };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format:', email);
      return { success: false, error: 'Invalid email format' };
    }
    
    console.log('✅ Email format is valid:', email);
    
    // Generate dynamic QR code with security features
    const { qrCode, qrData } = await qrManager.generateDynamicQR(ticketId);
    
    console.log('🔍 Dynamic QR Code generated for ticket:', ticketId);
    console.log('📋 QR Data:', qrData);
    console.log('🔗 QR Code URL:', qrCode);
    
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
            <h1>MEDCON'25 - Payment Confirmation</h1>
            <p>Your payment has been successfully received</p>
          </div>
          
          <p>Dear <strong>${fullName}</strong>,</p>
          
          <p>We are pleased to confirm that your payment for <strong>GIMSOC's 3rd Annual Medical Conference – MEDCON'25: Outbreaks to Breakthroughs</strong> has been successfully received. We look forward to welcoming you to the event!</p>
          
                    <p>This year's conference will revolve around the pressing theme of <strong>Infectious Disease</strong>, exploring the journey from global outbreaks to groundbreaking medical responses.</p>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">🗓 Conference Details</h4>
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Date:</strong> 24 & 25 October 2025, from 9:00 AM to 6:00 PM<br>
              <strong>Gala Night:</strong> 26 October from 6:00 PM to 12:00 AM<br>
              <strong>Venue:</strong> To Be Announced
            </p>
          </div>
            
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
          
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #e7f3ff; border: 2px solid #007bff; border-radius: 10px;">
            <h3 style="margin: 0 0 15px 0; color: #0056b3; font-size: 18px;">🎫 Your Dynamic QR Code</h3>
            <p style="margin: 0 0 20px 0; color: #0056b3; font-size: 14px;">
              Experience the full BookMyShow-style animated QR code with real-time updates!
            </p>
            <a href="https://www.medcongimsoc.com/ticket-qr/${ticketId}" 
               style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">
              🚀 View Live Animated QR Code
            </a>
            <p style="font-size: 12px; margin: 10px 0; color: #0056b3;">
              This link provides a professional QR experience with animations and live updates
            </p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">📋 Ticket Details (Text Version)</h4>
            <pre style="margin: 0; font-family: monospace; font-size: 12px; color: #495057; white-space: pre-wrap;">${ticketText}</pre>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e8; border: 1px solid #c3e6c3; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #155724; font-size: 14px;">🔐 Dynamic QR Data (For Manual Entry)</h4>
            <p style="margin: 0 0 10px 0; color: #155724; font-size: 12px;">
              If QR code doesn't display, you can manually enter this data at check-in:
            </p>
            <pre style="margin: 0; font-family: monospace; font-size: 10px; color: #495057; white-space: pre-wrap; background: #f8f9fa; padding: 10px; border-radius: 4px;">${JSON.stringify(qrData, null, 2)}</pre>
          </div>
          
          <p style="margin: 10px 0 0 0; color: #dc3545; font-size: 11px;">
            <strong>Note:</strong> Your QR code updates every 5 minutes for security. Use the Ticket ID or QR data above if needed.
          </p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 14px;">⚠️ Important Information</h4>
            <p style="margin: 0; color: #721c24; font-size: 12px;">
              <strong>Please make sure to arrive at least 30 minutes early on each day for check-in and onboarding.</strong>
            </p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #0c5460; font-size: 14px;">🔗 Additional Resources</h4>
            <p style="margin: 0; color: #0c5460; font-size: 12px;">
              <strong>Website:</strong> <a href="https://www.medcongimsoc.com" style="color: #007bff;">www.medcongimsoc.com</a><br>
              <strong>Instagram:</strong> @medcon_gimsoc | @gimsoc_<br>
              <strong>Email:</strong> medconconferencegimsoc@gmail.com
            </p>
          </div>
          
          <p>Thank you again for joining us. We look forward to an inspiring and collaborative experience together!</p>
          
          <p><strong>Best regards,</strong><br>
          Nupura Ajesh & Saja Mohamed<br>
          Head & Asst. Head of Registration & Attendee Services (Respectively)<br>
          MEDCON'25 | Georgian International Medical Student Society (GIMSOC)</p>
          
          <div class="footer">
            <p><strong>📧</strong> medconconferencegimsoc@gmail.com | gimsoc21@gmail.com<br>
            <strong>🌐</strong> www.medcongimsoc.com | www.gimsoc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log('📧 Attempting to send email with Brevo...');
    console.log('📧 From:', 'MEDCON 2025 <noreply@medcongimsoc.com>');
    console.log('📧 To:', email);
    console.log('📧 Subject:', "GIMSOC's MEDCON'25 – Payment Confirmation");

    // Create Brevo email object
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.to = [{ email: email, name: fullName }];
    sendSmtpEmail.subject = "GIMSOC's MEDCON'25 – Payment Confirmation";
    sendSmtpEmail.htmlContent = emailContent;
    sendSmtpEmail.sender = { name: "MEDCON 2025", email: "noreply@medcongimsoc.com" };

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('✅ Confirmation email sent successfully to:', email);
    console.log('✅ Brevo response data:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    console.error('❌ Error stack:', error.stack);
    return { success: false, error };
  }
};

const sendTicketApprovalEmail = async (userData) => {
  try {
    const { fullName, email, ticketType, ticketCategory } = userData;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MEDCON 2025 - Ticket Approved</title>
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 123, 255, 0.3);
            transition: all 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 123, 255, 0.4);
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✅</div>
            <h1>Ticket Approved!</h1>
            <p>Your MEDCON'25 ticket has been successfully approved</p>
          </div>
          
          <p>Dear <strong>${fullName}</strong>,</p>
          
          <p>Great news! Your ticket for <strong>MEDCON'25: Outbreaks to Breakthroughs</strong> has been successfully approved by our admin team.</p>
          
          <div class="ticket-details">
            <h3>🎫 Ticket Information</h3>
            <div class="detail-row">
              <span class="detail-label">Ticket Type:</span>
              <span class="detail-value">${ticketType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">${ticketCategory}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value" style="color: #28a745; font-weight: bold;">✅ Approved</span>
            </div>
          </div>
          
          <p>You can now access your personalized dashboard to view your ticket details, conference schedule, and more!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.medcongimsoc.com/dashboard-login" class="cta-button">
              🚀 Access Your Dashboard
            </a>
            <p style="font-size: 12px; margin: 10px 0; color: #6c757d;">
              Use your email and dashboard password to log in
            </p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #0c5460; font-size: 14px;">🔗 Additional Resources</h4>
            <p style="margin: 0; color: #0c5460; font-size: 12px;">
              <strong>Website:</strong> <a href="https://www.medcongimsoc.com" style="color: #007bff;">www.medcongimsoc.com</a><br>
              <strong>Instagram:</strong> @medcon_gimsoc | @gimsoc_<br>
              <strong>Email:</strong> medconconferencegimsoc@gmail.com
            </p>
          </div>
          
          <p>Thank you for choosing MEDCON'25. We look forward to seeing you at the conference!</p>
          
          <p><strong>Best regards,</strong><br>
          Nupura Ajesh & Saja Mohamed<br>
          Head & Asst. Head of Registration & Attendee Services (Respectively)<br>
          MEDCON'25 | Georgian International Medical Student Society (GIMSOC)</p>
          
          <div class="footer">
            <p><strong>📧</strong> medconconferencegimsoc@gmail.com | gimsoc21@gmail.com<br>
            <strong>🌐</strong> www.medcongimsoc.com | www.gimsoc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create Brevo email object
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.to = [{ email: email, name: fullName }];
    sendSmtpEmail.subject = "MEDCON'25 - Your Ticket Has Been Approved! 🎉";
    sendSmtpEmail.htmlContent = emailContent;
    sendSmtpEmail.sender = { name: "MEDCON 2025", email: "medconconferencegimsoc@gmail.com" };

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('✅ Approval email sent successfully to:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    return { success: false, error };
  }
};

const sendTicketRejectionEmail = async (userData) => {
  try {
    const { fullName, email, ticketType, ticketCategory } = userData;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MEDCON 2025 - Ticket Status Update</title>
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
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
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
          .status-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .ticket-details {
            background-color: #f8f9fa;
            border-left: 4px solid #dc3545;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .ticket-details h3 {
            margin: 0 0 15px 0;
            color: #dc3545;
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
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 123, 255, 0.3);
            transition: all 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 123, 255, 0.4);
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="status-icon">⚠️</div>
            <h1>Ticket Status Update</h1>
            <p>Your MEDCON'25 ticket application has been reviewed</p>
          </div>
          
          <p>Dear <strong>${fullName}</strong>,</p>
          
          <p>We regret to inform you that your ticket application for <strong>MEDCON'25: Outbreaks to Breakthroughs</strong> has not been approved at this time.</p>
          
          <div class="ticket-details">
            <h3>🎫 Application Details</h3>
            <div class="detail-row">
              <span class="detail-label">Ticket Type:</span>
              <span class="detail-value">${ticketType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">${ticketCategory}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value" style="color: #dc3545; font-weight: bold;">❌ Not Approved</span>
            </div>
          </div>
          
          <p>This decision may be due to various factors including incomplete information, payment issues, or capacity limitations. If you believe this is an error or would like to reapply, please contact our support team.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.medcongimsoc.com/tickets" class="cta-button">
              🔄 Reapply for Ticket
            </a>
            <p style="font-size: 12px; margin: 10px 0; color: #6c757d;">
              You can submit a new application with updated information
            </p>
          </div>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #0c5460; font-size: 14px;">📞 Need Help?</h4>
            <p style="margin: 0; color: #0c5460; font-size: 12px;">
              If you have any questions or need assistance, please contact us:<br>
              <strong>Email:</strong> medconconferencegimsoc@gmail.com<br>
              <strong>Website:</strong> <a href="https://www.medcongimsoc.com" style="color: #007bff;">www.medcongimsoc.com</a>
            </p>
          </div>
          
          <p>We appreciate your interest in MEDCON'25 and hope to see you at future events.</p>
          
          <p><strong>Best regards,</strong><br>
          Nupura Ajesh & Saja Mohamed<br>
          Head & Asst. Head of Registration & Attendee Services (Respectively)<br>
          MEDCON'25 | Georgian International Medical Student Society (GIMSOC)</p>
          
          <div class="footer">
            <p><strong>📧</strong> medconconferencegimsoc@gmail.com | gimsoc21@gmail.com<br>
            <strong>🌐</strong> www.medcongimsoc.com | www.gimsoc.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create Brevo email object
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.to = [{ email: email, name: fullName }];
    sendSmtpEmail.subject = "MEDCON'25 - Ticket Application Status Update";
    sendSmtpEmail.htmlContent = emailContent;
    sendSmtpEmail.sender = { name: "MEDCON 2025", email: "noreply@medcongimsoc.com" };

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('✅ Rejection email sent successfully to:', email);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error sending rejection email:', error);
    return { success: false, error };
  }
};

module.exports = {
  sendTicketConfirmationEmail,
  sendTicketApprovalEmail,
  sendTicketRejectionEmail
}; 