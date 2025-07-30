# Render Log User Search Documentation

## 🔍 **Finding Users Who Tried to Register But Didn't Make It to Your Database**

This system allows you to search for specific users in your Render logs, including those who attempted registration but never appeared in your admin dashboard due to various failures.

---

## 🚀 **Quick Start: How to Search for a User**

### **Step 1: Get Your Render Logs**
1. Go to your Render dashboard
2. Navigate to your service
3. Click on "Logs" tab
4. Copy the log text (or use our script to fetch automatically)

### **Step 2: Search for Specific User**
```bash
POST /api/admin/search-user-in-logs
{
  "logText": "your-render-logs-here",
  "email": "user@example.com"
}
```

### **Step 3: Interpret Results**
The API will tell you:
- ✅ **IN_DATABASE_AND_LOGS**: User registered successfully
- ⚠️ **IN_DATABASE_ONLY**: User in database but no log activity found
- 🔍 **IN_LOGS_ONLY**: User tried to register but failed
- ❌ **NOT_FOUND**: No trace of user found

---

## 📊 **API Endpoints for User Search**

### **1. Search for Specific User**
**POST** `/api/admin/search-user-in-logs`

Find a specific user in logs and compare with database.

```json
{
  "logText": "your-render-logs-text",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "searchEmail": "john@example.com",
  "userStatus": "IN_LOGS_ONLY",
  "found": true,
  "inDatabase": false,
  "logActivity": {
    "email": "john@example.com",
    "found": true,
    "totalEvents": 5,
    "events": [
      {
        "lineNumber": 1234,
        "timestamp": "2025-01-15T10:30:00.000Z",
        "logLine": "📋 Email from request: john@example.com",
        "eventType": "EMAIL_VALIDATION",
        "severity": "INFO"
      }
    ],
    "analysis": {
      "registrationAttempted": true,
      "registrationCompleted": false,
      "emailValidationPassed": true,
      "ticketSaved": false,
      "emailSent": false,
      "errors": ["Database connection timeout"],
      "timeline": [
        "User started registration process",
        "Email validation passed",
        "Database error occurred"
      ],
      "conclusion": "REGISTRATION_FAILED"
    }
  },
  "recommendations": [
    "User attempted registration but failed - investigate the errors and possibly contact user"
  ]
}
```

### **2. Find All Failed Registrations**
**POST** `/api/admin/find-failed-registrations`

Discover all users who tried to register but failed.

```json
{
  "logText": "your-render-logs-text"
}
```

**Response:**
```json
{
  "message": "Found 15 potential failed registrations",
  "totalAttempts": 20,
  "trulyFailed": 15,
  "falsePositives": 5,
  "failedRegistrations": [
    {
      "email": "failed-user@example.com",
      "firstSeen": 1234,
      "events": [...],
      "analysis": {
        "conclusion": "REGISTRATION_FAILED",
        "errors": ["Database timeout", "Validation error"]
      }
    }
  ]
}
```

### **3. Extract All Emails from Logs**
**POST** `/api/admin/extract-emails-from-logs`

Get all email addresses mentioned in logs and check database status.

```json
{
  "logText": "your-render-logs-text"
}
```

**Response:**
```json
{
  "message": "Found 50 unique emails in logs",
  "totalEmails": 50,
  "inDatabase": 35,
  "notInDatabase": 15,
  "emailsNotInDatabase": [
    "potential-lost-user1@example.com",
    "potential-lost-user2@example.com"
  ],
  "existingUsers": [...]
}
```

---

## 🔧 **Using the Render Log Fetcher Script**

### **Setup:**
```bash
# Add to your .env file
RENDER_API_KEY=your_render_api_key_here
RENDER_SERVICE_ID=your_service_id_here

# Run the script
node scripts/fetch-render-logs.js [service-id] [hours-back]
```

### **Examples:**
```bash
# Fetch last 24 hours of logs
node scripts/fetch-render-logs.js srv-abc123 24

# Fetch last 7 days of logs
node scripts/fetch-render-logs.js srv-abc123 168

# Save report to file
SAVE_REPORT=true node scripts/fetch-render-logs.js srv-abc123 24
```

---

## 🕵️ **What the System Can Detect**

### **Registration Flow Events:**
- ✅ **Email Validation**: User started registration
- ✅ **Email Uniqueness Check**: System checked if email exists
- ✅ **Ticket Saving**: Attempting to save to database
- ✅ **Ticket Saved**: Successfully saved to database
- ✅ **Email Queued**: Confirmation email queued
- ✅ **Email Sent**: Confirmation email sent successfully

### **Common Failure Points:**
- ❌ **Duplicate Email**: User tried to register with existing email
- ❌ **Database Timeout**: Database save failed
- ❌ **Validation Error**: Registration data invalid
- ❌ **API Key Error**: Email service not configured
- ❌ **Rate Limit**: Too many requests
- ❌ **Payment Failed**: Payment processing failed

### **User Status Classifications:**
- **REGISTRATION_COMPLETE**: ✅ User registered and got email
- **REGISTRATION_COMPLETE_EMAIL_FAILED**: ✅ Registered but no email
- **REGISTRATION_FAILED**: ❌ Registration attempt failed
- **DUPLICATE_EMAIL**: ⚠️ Tried to register with existing email
- **ERROR_OCCURRED**: ❌ Various errors during process
- **PARTIAL_ACTIVITY**: 🔍 Some activity but incomplete

---

## 📋 **Common Use Cases**

### **Case 1: User Says "I Registered But Never Got Email"**
```bash
POST /api/admin/search-user-in-logs
{
  "email": "user@example.com",
  "logText": "render-logs"
}
```

**Possible Results:**
- **IN_DATABASE_AND_LOGS** → User registered, check email delivery
- **IN_LOGS_ONLY** → Registration failed, investigate errors
- **NOT_FOUND** → User may not have actually registered

### **Case 2: Find All Lost Registrations**
```bash
POST /api/admin/find-failed-registrations
{
  "logText": "render-logs"
}
```

**Action:** Contact these users to help them complete registration

### **Case 3: Audit All Email Activity**
```bash
POST /api/admin/extract-emails-from-logs
{
  "logText": "render-logs"
}
```

**Action:** Compare with database to find discrepancies

---

## 🔍 **Log Patterns the System Recognizes**

### **Registration Patterns:**
```
📋 Email from request: user@example.com
🔍 Checking email uniqueness for: user@example.com
✅ Email uniqueness check passed for: user@example.com
💾 Saving ticket to database...
✅ Ticket saved successfully with ID: 507f1f77bcf86cd799439011
```

### **Email Patterns:**
```
📧 Email queued for user@example.com. Queue length: 3
✅ Email sent successfully to: user@example.com
❌ Email failed for user@example.com: rate limit exceeded
```

### **Error Patterns:**
```
❌ Email already exists: user@example.com
❌ Database save timeout
❌ RESEND_API_KEY environment variable is not set
❌ Validation error: email is required
```

---

## 🚨 **Troubleshooting Failed Registrations**

### **Common Issues and Solutions:**

| Issue | Log Pattern | Solution |
|-------|-------------|----------|
| **Duplicate Email** | `❌ Email already exists` | User already has account, help them log in |
| **Database Timeout** | `Database save timeout` | Check database connection, may need to retry |
| **Missing API Key** | `RESEND_API_KEY not set` | Configure email service |
| **Rate Limiting** | `rate limit exceeded` | Users hit too fast, system will retry |
| **Validation Error** | `Validation error` | Registration data was invalid |
| **Payment Failed** | `Payment failed` | Payment processing issue |

### **Recovery Actions:**
1. **For Database Issues**: Manually create user account
2. **For Email Issues**: Resend confirmation emails
3. **For Validation Issues**: Contact user for correct information
4. **For Payment Issues**: Help user retry payment

---

## 💡 **Pro Tips**

### **1. Regular Monitoring**
```bash
# Check for failed registrations daily
POST /api/admin/find-failed-registrations
```

### **2. Proactive User Recovery**
- Set up alerts for failed registrations
- Contact users within 24 hours of failed attempts
- Offer manual registration assistance

### **3. System Health Monitoring**
- Monitor API key errors
- Watch for database timeouts
- Track email delivery rates

### **4. Frontend Integration**
```javascript
// Search for user in logs
const searchUser = async (email, logText) => {
  const response = await fetch('/api/admin/search-user-in-logs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, logText })
  });
  return response.json();
};
```

---

## 📈 **Analytics You Can Generate**

### **Registration Success Rate**
```javascript
const successRate = (completedRegistrations / totalAttempts) * 100;
```

### **Common Failure Points**
- Database issues: X%
- Email delivery: Y%
- Validation errors: Z%

### **User Recovery Opportunities**
- Users who started but didn't complete: N
- Users with email delivery failures: M
- Users with payment issues: P

---

**Last Updated:** January 2025  
**System Version:** MEDCON 2025 User Search System v1.0