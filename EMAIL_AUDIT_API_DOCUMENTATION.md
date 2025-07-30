# Email Audit API Documentation

## 📧 **Email Tracking & Audit System**

This API allows you to track all registered users and their email delivery status, identify users who haven't received emails, and resend emails to specific users or groups.

---

## 🔐 **Authentication**

All endpoints require admin authentication. Include the admin JWT token in the Authorization header:

```
Authorization: Bearer <admin_jwt_token>
```

---

## 📊 **Main Email Audit Endpoint**

### **GET** `/api/admin/email-audit`

Get a paginated list of all users with their email delivery status and comprehensive statistics.

#### **Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 50 | Number of records per page |
| `emailStatus` | string | 'all' | Filter by email status: `sent`, `not_sent`, `failed` |
| `paymentStatus` | string | 'all' | Filter by payment status: `pending`, `completed`, `rejected` |
| `search` | string | '' | Search by name or email |

#### **Example Request:**
```bash
GET /api/admin/email-audit?page=1&limit=25&emailStatus=not_sent&search=john
```

#### **Response:**
```json
{
  "tickets": [
    {
      "_id": "ticket_id_here",
      "fullName": "John Doe",
      "email": "john@example.com",
      "ticketType": "Standard",
      "ticketCategory": "Student",
      "paymentStatus": "completed",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "emailTracking": {
        "confirmationEmailSent": false,
        "confirmationEmailSentAt": null,
        "confirmationEmailAttempts": 2,
        "approvalEmailSent": true,
        "approvalEmailSentAt": "2025-01-15T11:00:00.000Z",
        "rejectionEmailSent": false,
        "rejectionEmailSentAt": null,
        "lastEmailError": "RESEND_API_KEY environment variable is not set",
        "lastEmailErrorAt": "2025-01-15T10:35:00.000Z",
        "emailQueueJobIds": ["job_123", "job_124"]
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 125,
    "hasNext": true,
    "hasPrev": false
  },
  "statistics": {
    "totalUsers": 125,
    "confirmationEmailsSent": 98,
    "confirmationEmailsNotSent": 27,
    "confirmationEmailSuccessRate": "78.40%",
    "approvalEmailsSent": 45,
    "rejectionEmailsSent": 12,
    "usersWithErrors": 27,
    "pendingUsers": 30,
    "completedUsers": 80,
    "rejectedUsers": 15
  },
  "filters": {
    "emailStatus": "not_sent",
    "paymentStatus": "all",
    "search": "john"
  },
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## 🚫 **Users Without Emails**

### **GET** `/api/admin/users-without-emails`

Get all users who haven't received confirmation emails.

#### **Response:**
```json
{
  "count": 27,
  "tickets": [
    {
      "_id": "ticket_id_here",
      "fullName": "Jane Smith",
      "email": "jane@example.com",
      "ticketType": "VIP",
      "ticketCategory": "Professional",
      "paymentStatus": "completed",
      "createdAt": "2025-01-15T09:15:00.000Z",
      "emailTracking": {
        "confirmationEmailSent": false,
        "confirmationEmailAttempts": 3,
        "lastEmailError": "rate limit exceeded"
      }
    }
  ],
  "message": "Found 27 users who haven't received confirmation emails",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## ❌ **Users With Email Errors**

### **GET** `/api/admin/users-with-email-errors`

Get all users who have email delivery errors.

#### **Response:**
```json
{
  "count": 15,
  "tickets": [
    {
      "_id": "ticket_id_here",
      "fullName": "Bob Wilson",
      "email": "bob@example.com",
      "ticketType": "Standard",
      "ticketCategory": "Student",
      "paymentStatus": "pending",
      "createdAt": "2025-01-15T08:30:00.000Z",
      "emailTracking": {
        "confirmationEmailSent": false,
        "lastEmailError": "Invalid email format",
        "lastEmailErrorAt": "2025-01-15T08:35:00.000Z",
        "confirmationEmailAttempts": 1
      }
    }
  ],
  "message": "Found 15 users with email errors",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## 🔄 **Resend Confirmation Emails**

### **POST** `/api/admin/resend-confirmation-emails`

Resend confirmation emails to users who haven't received them.

#### **Request Body:**
```json
{
  "resendAll": true
}
```

**OR**

```json
{
  "ticketIds": ["ticket_id_1", "ticket_id_2", "ticket_id_3"]
}
```

#### **Parameters:**
- `resendAll`: boolean - If true, resends to all users without confirmation emails
- `ticketIds`: array - Specific ticket IDs to resend to

#### **Response:**
```json
{
  "message": "Successfully queued 27 confirmation emails for resending",
  "queuedCount": 27,
  "queuedTickets": [
    {
      "ticketId": "ticket_id_1",
      "email": "user1@example.com",
      "fullName": "User One",
      "jobId": "job_456"
    }
  ],
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## 📮 **Resend Status Emails**

### **POST** `/api/admin/resend-status-emails`

Resend approval or rejection emails to specific users.

#### **Request Body:**
```json
{
  "ticketIds": ["ticket_id_1", "ticket_id_2"],
  "emailType": "approval"
}
```

#### **Parameters:**
- `ticketIds`: array (required) - Ticket IDs to resend emails to
- `emailType`: string (required) - Either "approval" or "rejection"

#### **Response:**
```json
{
  "message": "Resent 8 approval emails out of 10 tickets",
  "sentCount": 8,
  "totalCount": 10,
  "results": [
    {
      "ticketId": "ticket_id_1",
      "email": "user1@example.com",
      "status": "sent"
    },
    {
      "ticketId": "ticket_id_2",
      "email": "user2@example.com",
      "status": "failed",
      "error": "Invalid email address"
    }
  ],
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## 🧪 **Test Email**

### **POST** `/api/admin/test-email`

Send a test email to verify the email system is working.

#### **Request Body:**
```json
{
  "email": "test@example.com",
  "fullName": "Test User"
}
```

#### **Response:**
```json
{
  "message": "Test email queued successfully",
  "jobId": "job_789",
  "emailData": {
    "fullName": "Test User",
    "email": "test@example.com",
    "ticketType": "Test Email",
    "ticketCategory": "Admin Test",
    "ticketId": "TEST_1642248000000"
  },
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## 📈 **System Status (Enhanced)**

### **GET** `/api/admin/system-status`

Get system status including detailed email queue information.

#### **Response:**
```json
{
  "emailQueue": {
    "queueLength": 5,
    "isProcessing": true,
    "failedEmailsCount": 3,
    "oldestJob": 1642248000000,
    "failedEmails": [
      {
        "email": "user@example.com",
        "failureReason": "MAX_RETRIES_EXCEEDED",
        "retries": 3,
        "lastAttempt": 1642248000000,
        "errors": [
          {
            "timestamp": 1642248000000,
            "error": "rate limit exceeded"
          }
        ]
      }
    ]
  }
}
```

---

## 📝 **Email Tracking Data Structure**

Each user ticket now includes an `emailTracking` object with the following fields:

```javascript
emailTracking: {
  // Confirmation Email (sent after registration)
  confirmationEmailSent: boolean,          // Has confirmation email been sent?
  confirmationEmailSentAt: Date,           // When was it sent?
  confirmationEmailAttempts: number,       // How many attempts were made?
  
  // Approval Email (sent when admin approves)
  approvalEmailSent: boolean,              // Has approval email been sent?
  approvalEmailSentAt: Date,               // When was it sent?
  
  // Rejection Email (sent when admin rejects)
  rejectionEmailSent: boolean,             // Has rejection email been sent?
  rejectionEmailSentAt: Date,              // When was it sent?
  
  // Error Tracking
  lastEmailError: string,                  // Last error message
  lastEmailErrorAt: Date,                  // When did the last error occur?
  
  // Queue Tracking
  emailQueueJobIds: [string]               // Array of email queue job IDs
}
```

---

## 🔍 **Common Use Cases**

### **1. Find All Users Who Haven't Received Confirmation Emails:**
```bash
GET /api/admin/users-without-emails
```

### **2. Resend Confirmation Emails to All Missing Users:**
```bash
POST /api/admin/resend-confirmation-emails
{
  "resendAll": true
}
```

### **3. Find Users with Email Errors:**
```bash
GET /api/admin/users-with-email-errors
```

### **4. Get Email Statistics:**
```bash
GET /api/admin/email-audit?limit=1
# Check the statistics object in the response
```

### **5. Search for Specific User's Email Status:**
```bash
GET /api/admin/email-audit?search=john@example.com
```

### **6. Filter by Payment Status and Email Status:**
```bash
GET /api/admin/email-audit?paymentStatus=completed&emailStatus=not_sent
```

### **7. Resend Approval Emails to Specific Users:**
```bash
POST /api/admin/resend-status-emails
{
  "ticketIds": ["ticket_id_1", "ticket_id_2"],
  "emailType": "approval"
}
```

---

## ⚠️ **Important Notes**

1. **Rate Limiting**: The system automatically handles Resend's rate limits (2 req/sec)
2. **Automatic Tracking**: All email sends are automatically tracked in the database
3. **Error Handling**: Failed emails are tracked with specific error messages
4. **Queue Processing**: Confirmation emails go through the queue system, approval/rejection emails are sent immediately
5. **Pagination**: Large datasets are paginated for performance
6. **Real-time Updates**: Email tracking is updated in real-time as emails are processed

---

## 🚀 **Frontend Integration Examples**

### **React/JavaScript Example:**

```javascript
// Get email audit data
const getEmailAudit = async (page = 1, filters = {}) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '25',
    ...filters
  });
  
  const response = await fetch(`/api/admin/email-audit?${params}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
};

// Resend emails to users without confirmation
const resendMissingEmails = async () => {
  const response = await fetch('/api/admin/resend-confirmation-emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ resendAll: true })
  });
  
  return response.json();
};

// Get users without emails
const getUsersWithoutEmails = async () => {
  const response = await fetch('/api/admin/users-without-emails', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  return response.json();
};
```

---

**Last Updated:** January 2025  
**API Version:** MEDCON 2025 Email Audit System v1.0