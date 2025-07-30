// Enhanced Email Logging System for Render Log Parsing
const fs = require('fs');
const path = require('path');

class EmailLogger {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/email.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Create structured log entry that's easy to parse
  createLogEntry(type, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      ...data
    };

    // Console log for Render (structured format)
    console.log(`EMAIL_LOG: ${JSON.stringify(logEntry)}`);

    // Also write to file if possible (for local development)
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      // Ignore file write errors in production (Render doesn't support file writes)
    }

    return logEntry;
  }

  // Log email queue events
  logEmailQueued(emailData, jobId) {
    return this.createLogEntry('EMAIL_QUEUED', {
      jobId,
      email: emailData.email,
      fullName: emailData.fullName,
      ticketId: emailData.ticketId,
      ticketType: emailData.ticketType,
      ticketCategory: emailData.ticketCategory
    });
  }

  logEmailSent(emailData, jobId, resendResponse) {
    return this.createLogEntry('EMAIL_SENT', {
      jobId,
      email: emailData.email,
      fullName: emailData.fullName,
      ticketId: emailData.ticketId,
      resendMessageId: resendResponse?.id,
      success: true
    });
  }

  logEmailFailed(emailData, jobId, error, retryCount) {
    return this.createLogEntry('EMAIL_FAILED', {
      jobId,
      email: emailData.email,
      fullName: emailData.fullName,
      ticketId: emailData.ticketId,
      error: typeof error === 'string' ? error : error?.message || 'Unknown error',
      retryCount,
      success: false
    });
  }

  logEmailRetry(emailData, jobId, retryCount, maxRetries) {
    return this.createLogEntry('EMAIL_RETRY', {
      jobId,
      email: emailData.email,
      fullName: emailData.fullName,
      ticketId: emailData.ticketId,
      retryCount,
      maxRetries
    });
  }

  logEmailPermanentFailure(emailData, jobId, finalError) {
    return this.createLogEntry('EMAIL_PERMANENT_FAILURE', {
      jobId,
      email: emailData.email,
      fullName: emailData.fullName,
      ticketId: emailData.ticketId,
      finalError: typeof finalError === 'string' ? finalError : finalError?.message || 'Unknown error',
      success: false
    });
  }

  logApprovalEmail(ticketData, success, error = null) {
    return this.createLogEntry('APPROVAL_EMAIL', {
      email: ticketData.email,
      fullName: ticketData.fullName,
      ticketId: ticketData.ticketId || ticketData._id,
      ticketType: ticketData.ticketType,
      success,
      error: error ? (typeof error === 'string' ? error : error?.message) : null
    });
  }

  logRejectionEmail(ticketData, success, error = null) {
    return this.createLogEntry('REJECTION_EMAIL', {
      email: ticketData.email,
      fullName: ticketData.fullName,
      ticketId: ticketData.ticketId || ticketData._id,
      ticketType: ticketData.ticketType,
      success,
      error: error ? (typeof error === 'string' ? error : error?.message) : null
    });
  }

  logQueueStatus(queueLength, isProcessing, failedCount) {
    return this.createLogEntry('QUEUE_STATUS', {
      queueLength,
      isProcessing,
      failedCount
    });
  }

  logAPIKeyError() {
    return this.createLogEntry('API_KEY_ERROR', {
      error: 'RESEND_API_KEY not configured',
      critical: true
    });
  }

  logRateLimit(delayMs) {
    return this.createLogEntry('RATE_LIMIT', {
      delayMs,
      message: 'Rate limit detected, adding delay'
    });
  }

  // Parse log entries from text (for analyzing Render logs)
  static parseLogEntry(logLine) {
    try {
      // Look for EMAIL_LOG: prefix
      const emailLogMatch = logLine.match(/EMAIL_LOG: (.+)/);
      if (emailLogMatch) {
        return JSON.parse(emailLogMatch[1]);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Extract all email logs from a text block (Render logs)
  static extractEmailLogs(logText) {
    const lines = logText.split('\n');
    const emailLogs = [];

    for (const line of lines) {
      const logEntry = this.parseLogEntry(line);
      if (logEntry) {
        emailLogs.push(logEntry);
      }
    }

    return emailLogs;
  }

  // Analyze email logs and create summary
  static analyzeEmailLogs(emailLogs) {
    const summary = {
      totalEmails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      permanentFailures: 0,
      retries: 0,
      queuedEmails: 0,
      approvalEmails: 0,
      rejectionEmails: 0,
      apiKeyErrors: 0,
      rateLimits: 0,
      emails: []
    };

    const emailMap = new Map();

    for (const log of emailLogs) {
      switch (log.type) {
        case 'EMAIL_QUEUED':
          summary.queuedEmails++;
          if (!emailMap.has(log.email)) {
            emailMap.set(log.email, {
              email: log.email,
              fullName: log.fullName,
              ticketId: log.ticketId,
              events: []
            });
          }
          emailMap.get(log.email).events.push(log);
          break;

        case 'EMAIL_SENT':
          summary.successfulEmails++;
          summary.totalEmails++;
          if (emailMap.has(log.email)) {
            emailMap.get(log.email).events.push(log);
            emailMap.get(log.email).success = true;
          }
          break;

        case 'EMAIL_FAILED':
          summary.failedEmails++;
          if (emailMap.has(log.email)) {
            emailMap.get(log.email).events.push(log);
          }
          break;

        case 'EMAIL_RETRY':
          summary.retries++;
          if (emailMap.has(log.email)) {
            emailMap.get(log.email).events.push(log);
          }
          break;

        case 'EMAIL_PERMANENT_FAILURE':
          summary.permanentFailures++;
          summary.totalEmails++;
          if (emailMap.has(log.email)) {
            emailMap.get(log.email).events.push(log);
            emailMap.get(log.email).success = false;
            emailMap.get(log.email).permanentFailure = true;
          }
          break;

        case 'APPROVAL_EMAIL':
          summary.approvalEmails++;
          if (log.success) summary.successfulEmails++;
          else summary.failedEmails++;
          break;

        case 'REJECTION_EMAIL':
          summary.rejectionEmails++;
          if (log.success) summary.successfulEmails++;
          else summary.failedEmails++;
          break;

        case 'API_KEY_ERROR':
          summary.apiKeyErrors++;
          break;

        case 'RATE_LIMIT':
          summary.rateLimits++;
          break;
      }
    }

    summary.emails = Array.from(emailMap.values());
    summary.successRate = summary.totalEmails > 0 
      ? ((summary.successfulEmails / summary.totalEmails) * 100).toFixed(2) + '%'
      : '0%';

    return summary;
  }
}

module.exports = EmailLogger;