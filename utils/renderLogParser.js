// Comprehensive Render Log Parser for User Search and Registration Analysis
const EmailLogger = require('./emailLogger');

class RenderLogParser {
  constructor() {
    // Regex patterns to extract different types of user data from logs
    this.patterns = {
      // Email patterns
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // Ticket submission patterns
      ticketSubmission: /💾 Saving ticket to database|📊 Ticket data to save/,
      ticketSaved: /✅ Ticket saved successfully with ID:/,
      ticketError: /❌ Error in ticket submission:/,
      
      // Email-related patterns
      emailQueued: /📧 Email queued for (.+?)\. Queue length:/,
      emailSent: /✅ Email sent successfully to: (.+)/,
      emailFailed: /❌ Email failed for (.+?):/,
      emailError: /❌ Error sending confirmation email:/,
      
      // User registration patterns
      userRegistration: /📋 Email from request: (.+)/,
      userValidation: /🔍 Checking email uniqueness for: (.+)/,
      emailExists: /❌ Email already exists: (.+)/,
      emailUnique: /✅ Email uniqueness check passed for: (.+)/,
      
      // Payment patterns
      paymentReceived: /Payment received for (.+)/,
      paymentFailed: /Payment failed for (.+)/,
      
      // API errors
      apiKeyError: /RESEND_API_KEY environment variable is not set/,
      rateLimitError: /rate limit|too many requests/i,
      
      // Database errors
      databaseError: /Database save timeout|MongoDB|mongoose/i,
      validationError: /Validation error|ValidationError/i,
      
      // General error patterns
      errorStack: /Error: (.+)/,
      criticalError: /❌|ERROR|CRITICAL/i
    };
  }

  // Extract all emails mentioned in logs
  extractAllEmails(logText) {
    const emails = new Set();
    const matches = logText.match(this.patterns.email);
    if (matches) {
      matches.forEach(email => {
        // Filter out system emails and common false positives
        if (!this.isSystemEmail(email)) {
          emails.add(email.toLowerCase());
        }
      });
    }
    return Array.from(emails);
  }

  // Check if email is a system email (not a user email)
  isSystemEmail(email) {
    const systemDomains = [
      'render.com',
      'github.com',
      'example.com',
      'test.com',
      'localhost',
      'medcongimsoc.com' // Your own domain emails
    ];
    
    const systemEmails = [
      'noreply@medcongimsoc.com',
      'admin@medcongimsoc.com'
    ];

    return systemEmails.includes(email.toLowerCase()) ||
           systemDomains.some(domain => email.toLowerCase().endsWith('@' + domain));
  }

  // Search for a specific user in logs
  searchUserInLogs(logText, searchEmail) {
    const lines = logText.split('\n');
    const userEvents = [];
    const searchEmailLower = searchEmail.toLowerCase();
    
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchEmailLower)) {
        userEvents.push({
          lineNumber: index + 1,
          timestamp: this.extractTimestamp(line),
          logLine: line.trim(),
          eventType: this.classifyLogEvent(line),
          severity: this.getLogSeverity(line)
        });
      }
    });

    return {
      email: searchEmail,
      found: userEvents.length > 0,
      totalEvents: userEvents.length,
      events: userEvents,
      analysis: this.analyzeUserEvents(userEvents, searchEmail)
    };
  }

  // Extract timestamp from log line
  extractTimestamp(logLine) {
    // Common timestamp patterns
    const timestampPatterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.?\d*Z?/,  // ISO format
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,           // Standard format
      /\w{3} \w{3} \d{2} \d{4} \d{2}:\d{2}:\d{2}/      // Date format
    ];

    for (const pattern of timestampPatterns) {
      const match = logLine.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  }

  // Classify what type of event this log line represents
  classifyLogEvent(logLine) {
    const line = logLine.toLowerCase();
    
    if (line.includes('email queued') || line.includes('📧 email queued')) {
      return 'EMAIL_QUEUED';
    }
    if (line.includes('email sent successfully') || line.includes('✅ email sent')) {
      return 'EMAIL_SENT';
    }
    if (line.includes('email failed') || line.includes('❌ email failed')) {
      return 'EMAIL_FAILED';
    }
    if (line.includes('saving ticket to database') || line.includes('💾 saving ticket')) {
      return 'TICKET_SAVING';
    }
    if (line.includes('ticket saved successfully') || line.includes('✅ ticket saved')) {
      return 'TICKET_SAVED';
    }
    if (line.includes('checking email uniqueness') || line.includes('🔍 checking email')) {
      return 'EMAIL_VALIDATION';
    }
    if (line.includes('email already exists') || line.includes('❌ email already exists')) {
      return 'EMAIL_DUPLICATE';
    }
    if (line.includes('email uniqueness check passed') || line.includes('✅ email uniqueness')) {
      return 'EMAIL_UNIQUE';
    }
    if (line.includes('payment') && (line.includes('received') || line.includes('success'))) {
      return 'PAYMENT_SUCCESS';
    }
    if (line.includes('payment') && (line.includes('failed') || line.includes('error'))) {
      return 'PAYMENT_FAILED';
    }
    if (line.includes('api key') && line.includes('not set')) {
      return 'API_KEY_ERROR';
    }
    if (line.includes('rate limit') || line.includes('too many requests')) {
      return 'RATE_LIMIT';
    }
    if (line.includes('database') && (line.includes('timeout') || line.includes('error'))) {
      return 'DATABASE_ERROR';
    }
    if (line.includes('validation error') || line.includes('validationerror')) {
      return 'VALIDATION_ERROR';
    }
    if (line.includes('❌') || line.includes('error') || line.includes('failed')) {
      return 'ERROR';
    }
    if (line.includes('✅') || line.includes('success')) {
      return 'SUCCESS';
    }
    
    return 'INFO';
  }

  // Get severity level of log line
  getLogSeverity(logLine) {
    const line = logLine.toLowerCase();
    
    if (line.includes('critical') || line.includes('💀')) {
      return 'CRITICAL';
    }
    if (line.includes('❌') || line.includes('error') || line.includes('failed')) {
      return 'ERROR';
    }
    if (line.includes('⚠️') || line.includes('warning') || line.includes('warn')) {
      return 'WARNING';
    }
    if (line.includes('✅') || line.includes('success')) {
      return 'SUCCESS';
    }
    
    return 'INFO';
  }

  // Analyze user events to determine what happened
  analyzeUserEvents(events, email) {
    const analysis = {
      registrationAttempted: false,
      registrationCompleted: false,
      emailValidationPassed: false,
      ticketSaved: false,
      emailSent: false,
      errors: [],
      warnings: [],
      timeline: [],
      conclusion: 'UNKNOWN'
    };

    // Sort events by line number (chronological order)
    const sortedEvents = events.sort((a, b) => a.lineNumber - b.lineNumber);

    sortedEvents.forEach(event => {
      switch (event.eventType) {
        case 'EMAIL_VALIDATION':
          analysis.registrationAttempted = true;
          analysis.timeline.push('User started registration process');
          break;
        
        case 'EMAIL_UNIQUE':
          analysis.emailValidationPassed = true;
          analysis.timeline.push('Email validation passed');
          break;
        
        case 'EMAIL_DUPLICATE':
          analysis.errors.push('Email already exists in system');
          analysis.timeline.push('Registration failed - duplicate email');
          break;
        
        case 'TICKET_SAVING':
          analysis.timeline.push('Attempting to save ticket to database');
          break;
        
        case 'TICKET_SAVED':
          analysis.registrationCompleted = true;
          analysis.ticketSaved = true;
          analysis.timeline.push('Ticket successfully saved to database');
          break;
        
        case 'EMAIL_QUEUED':
          analysis.timeline.push('Confirmation email queued');
          break;
        
        case 'EMAIL_SENT':
          analysis.emailSent = true;
          analysis.timeline.push('Confirmation email sent successfully');
          break;
        
        case 'EMAIL_FAILED':
          analysis.errors.push('Email sending failed');
          analysis.timeline.push('Confirmation email failed to send');
          break;
        
        case 'API_KEY_ERROR':
          analysis.errors.push('Email service not configured (missing API key)');
          analysis.timeline.push('Email system error - API key missing');
          break;
        
        case 'RATE_LIMIT':
          analysis.warnings.push('Rate limit encountered');
          analysis.timeline.push('Rate limit hit - email delayed');
          break;
        
        case 'DATABASE_ERROR':
          analysis.errors.push('Database connection or save error');
          analysis.timeline.push('Database error occurred');
          break;
        
        case 'VALIDATION_ERROR':
          analysis.errors.push('Data validation failed');
          analysis.timeline.push('Registration data validation failed');
          break;
        
        case 'PAYMENT_SUCCESS':
          analysis.timeline.push('Payment processed successfully');
          break;
        
        case 'PAYMENT_FAILED':
          analysis.errors.push('Payment processing failed');
          analysis.timeline.push('Payment failed');
          break;
        
        case 'ERROR':
          analysis.errors.push(`General error: ${event.logLine}`);
          break;
      }
    });

    // Determine conclusion
    if (analysis.registrationCompleted && analysis.emailSent) {
      analysis.conclusion = 'REGISTRATION_COMPLETE';
    } else if (analysis.registrationCompleted && !analysis.emailSent) {
      analysis.conclusion = 'REGISTRATION_COMPLETE_EMAIL_FAILED';
    } else if (analysis.registrationAttempted && !analysis.registrationCompleted) {
      analysis.conclusion = 'REGISTRATION_FAILED';
    } else if (events.some(e => e.eventType === 'EMAIL_DUPLICATE')) {
      analysis.conclusion = 'DUPLICATE_EMAIL';
    } else if (analysis.errors.length > 0) {
      analysis.conclusion = 'ERROR_OCCURRED';
    } else if (events.length > 0) {
      analysis.conclusion = 'PARTIAL_ACTIVITY';
    }

    return analysis;
  }

  // Find users who attempted registration but failed
  findFailedRegistrations(logText) {
    const lines = logText.split('\n');
    const failedUsers = new Map();
    
    lines.forEach((line, index) => {
      // Look for registration attempts
      const emailMatch = line.match(/📋 Email from request: (.+)/);
      if (emailMatch) {
        const email = emailMatch[1].trim().toLowerCase();
        if (!failedUsers.has(email)) {
          failedUsers.set(email, {
            email,
            firstSeen: index + 1,
            events: [],
            registrationCompleted: false
          });
        }
        failedUsers.get(email).events.push({
          lineNumber: index + 1,
          event: 'REGISTRATION_ATTEMPT',
          logLine: line.trim()
        });
      }

      // Check for successful saves
      const savedMatch = line.match(/✅ Ticket saved successfully with ID: (.+)/);
      if (savedMatch) {
        // Try to find which email this belongs to by looking at recent lines
        for (let i = Math.max(0, index - 20); i < index; i++) {
          const prevLine = lines[i];
          const prevEmailMatch = prevLine.match(/📋 Email from request: (.+)/);
          if (prevEmailMatch) {
            const email = prevEmailMatch[1].trim().toLowerCase();
            if (failedUsers.has(email)) {
              failedUsers.get(email).registrationCompleted = true;
              failedUsers.get(email).events.push({
                lineNumber: index + 1,
                event: 'REGISTRATION_SUCCESS',
                logLine: line.trim()
              });
            }
            break;
          }
        }
      }
    });

    // Filter to only failed registrations
    const failed = Array.from(failedUsers.values()).filter(user => !user.registrationCompleted);
    
    return failed.map(user => ({
      ...user,
      analysis: this.analyzeUserEvents(user.events, user.email)
    }));
  }

  // Search for multiple users at once
  searchMultipleUsers(logText, emails) {
    const results = {};
    emails.forEach(email => {
      results[email] = this.searchUserInLogs(logText, email);
    });
    return results;
  }

  // Get comprehensive user activity report
  getUserActivityReport(logText, email) {
    const userSearch = this.searchUserInLogs(logText, email);
    const allEmails = this.extractAllEmails(logText);
    const emailLogs = EmailLogger.extractEmailLogs(logText);
    
    // Find email-specific logs
    const userEmailLogs = emailLogs.filter(log => 
      log.email && log.email.toLowerCase() === email.toLowerCase()
    );

    return {
      searchEmail: email,
      found: userSearch.found,
      inDatabase: null, // This will be filled by the API endpoint
      logActivity: userSearch,
      emailLogs: userEmailLogs,
      relatedEmails: allEmails.filter(e => 
        e.toLowerCase().includes(email.toLowerCase().split('@')[0])
      ),
      summary: {
        totalLogEntries: userSearch.totalEvents,
        emailLogEntries: userEmailLogs.length,
        registrationStatus: userSearch.analysis.conclusion,
        hasErrors: userSearch.analysis.errors.length > 0,
        hasWarnings: userSearch.analysis.warnings.length > 0
      }
    };
  }
}

module.exports = RenderLogParser;