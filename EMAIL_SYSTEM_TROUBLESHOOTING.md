# MEDCON Email System Troubleshooting Guide

## 🚨 **Common Issues & Solutions**

### **Issue 1: People Not Receiving Emails**

**Most Likely Causes:**
1. **Missing RESEND_API_KEY** (90% of cases)
2. **Rate limiting from Resend API**
3. **Invalid email addresses**
4. **Domain verification issues**

### **Quick Diagnosis Steps**

#### Step 1: Check Environment Configuration
```bash
npm run setup
```
This will check your environment variables and identify missing configurations.

#### Step 2: Check Admin Dashboard
- Go to `/api/admin/system-status` to see email queue status
- Go to `/api/admin/failed-emails` to see failed email attempts

#### Step 3: Test Email Sending
```bash
# Send a test email via admin API
POST /api/admin/test-email
{
  "email": "test@example.com",
  "fullName": "Test User"
}
```

## 🔧 **Detailed Solutions**

### **Solution 1: Fix Missing API Key**

1. **Get Resend API Key:**
   - Go to https://resend.com/api-keys
   - Create a new API key
   - Copy the key (starts with `re_`)

2. **Add to Environment:**
   ```bash
   # In your .env file
   RESEND_API_KEY=re_your_actual_key_here
   ```

3. **Restart Application:**
   ```bash
   npm start
   ```

### **Solution 2: Handle Rate Limiting**

**Resend Limits (2024-2025):**
- **Free Plan:** 3,000 emails/month, 100 emails/day
- **Rate Limit:** 2 requests per second
- **Pro Plan:** 50,000 emails/month, no daily limit

**Our System Handles:**
- ✅ 2-second delays between emails
- ✅ Automatic retry with exponential backoff
- ✅ Rate limit detection and extended delays
- ✅ Failed email tracking

### **Solution 3: Monitor Email Delivery**

#### Admin Endpoints Available:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/system-status` | GET | Check queue status |
| `/api/admin/failed-emails` | GET | View failed emails |
| `/api/admin/retry-failed-emails` | POST | Retry failed emails |
| `/api/admin/clear-failed-emails` | POST | Clear failed email list |
| `/api/admin/test-email` | POST | Send test email |
| `/api/admin/clear-email-queue` | POST | Clear current queue |

#### Example Usage:
```javascript
// Check system status
fetch('/api/admin/system-status')
  .then(res => res.json())
  .then(data => console.log(data.emailQueue));

// Retry failed emails
fetch('/api/admin/retry-failed-emails', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log(`Retried ${data.retriedCount} emails`));
```

## 📊 **Understanding Email Flow**

### **1. Ticket Registration Process**
```
User submits ticket → Ticket saved to DB → Email queued → Email sent
```

### **2. Email Queue Process**
```
Email added to queue → Queue processes (2 sec delays) → Retry on failure → Track failed emails
```

### **3. Admin Approval Process**
```
Admin approves ticket → Direct email send (not queued) → Success/failure logged
```

## 🔍 **Debugging Email Issues**

### **Check Database vs Email Status**

1. **Query tickets without emails sent:**
   ```javascript
   // In MongoDB or your admin interface
   db.usertickets.find({
     paymentStatus: "completed",
     // Check if there are tickets that should have received emails
   })
   ```

2. **Check email queue status:**
   ```bash
   # Via admin endpoint
   GET /api/admin/system-status
   ```

### **Common Error Messages**

| Error | Cause | Solution |
|-------|-------|----------|
| `RESEND_API_KEY environment variable is not set` | Missing API key | Add RESEND_API_KEY to .env |
| `rate limit exceeded` | Too many requests | Wait, system will retry automatically |
| `unauthorized` | Invalid API key | Check API key format and validity |
| `domain verification failed` | Domain not verified in Resend | Verify domain in Resend dashboard |

## 🚀 **Performance Optimization**

### **Current Settings**
- **Queue Delay:** 2 seconds between emails (respects 2 req/sec limit)
- **Retry Logic:** 3 attempts with exponential backoff
- **Rate Limit Handling:** 5-second delay when rate limited

### **Recommended for High Volume**
If you need to send more emails:

1. **Upgrade Resend Plan:**
   - Pro: $20/month for 50,000 emails
   - Scale: $90/month for 100,000 emails

2. **Consider Dedicated IP:**
   - Available on Scale plan for $30/month
   - Improves deliverability for high volume

3. **Implement Batch Processing:**
   - Group emails by type
   - Process during off-peak hours

## 📈 **Monitoring & Alerts**

### **Set Up Monitoring**
1. **Check failed emails daily:**
   ```bash
   curl -X GET /api/admin/failed-emails
   ```

2. **Monitor queue length:**
   ```bash
   curl -X GET /api/admin/system-status
   ```

3. **Set up alerts for:**
   - Queue length > 100 emails
   - Failed emails > 10
   - API key errors

### **Regular Maintenance**
- **Weekly:** Check and retry failed emails
- **Monthly:** Review email delivery rates
- **Quarterly:** Review Resend plan usage

## 🆘 **Emergency Procedures**

### **If Emails Completely Stop Working**

1. **Immediate Check:**
   ```bash
   npm run setup
   ```

2. **Check Resend Dashboard:**
   - Login to resend.com
   - Check API key status
   - Check domain verification
   - Check usage limits

3. **Manual Email Sending:**
   ```bash
   # Use admin test endpoint
   POST /api/admin/test-email
   ```

4. **Clear and Restart:**
   ```bash
   # Clear queue and restart
   POST /api/admin/clear-email-queue
   # Then restart application
   npm start
   ```

### **If Only Some Emails Fail**

1. **Check failed emails:**
   ```bash
   GET /api/admin/failed-emails
   ```

2. **Retry failed emails:**
   ```bash
   POST /api/admin/retry-failed-emails
   ```

3. **Investigate patterns:**
   - Specific domains failing?
   - Specific email formats?
   - Time-based failures?

## 📞 **Getting Help**

1. **Check this guide first**
2. **Run environment setup:** `npm run setup`
3. **Check admin endpoints for detailed error info**
4. **If still stuck, provide:**
   - Environment setup output
   - Failed emails list from admin endpoint
   - Recent application logs
   - Resend dashboard status

---

**Last Updated:** January 2025
**System Version:** MEDCON 2025 Conference System