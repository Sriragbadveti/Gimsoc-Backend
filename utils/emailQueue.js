const { sendTicketConfirmationEmail } = require('./emailService');
const UserTicket = require('../models/userModel');

class EmailQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.delayBetweenEmails = 2000; // 2 seconds between emails (Resend allows 2 req/sec)
    this.rateLimitDelay = 5000; // 5 seconds delay when rate limited
    this.failedEmails = []; // Track permanently failed emails
  }

  // Add email to queue
  addToQueue(emailData) {
    const emailJob = {
      id: Date.now() + Math.random(),
      data: emailData,
      retries: 0,
      timestamp: Date.now(),
      lastAttempt: null,
      errors: []
    };
    
    this.queue.push(emailJob);
    console.log(`📧 Email queued for ${emailData.email}. Queue length: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return emailJob.id;
  }

  // Process the email queue with proper rate limiting
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Starting email queue processing. ${this.queue.length} emails in queue`);

    while (this.queue.length > 0) {
      const emailJob = this.queue.shift();
      emailJob.lastAttempt = Date.now();
      
      try {
        console.log(`📧 Sending email to ${emailJob.data.email} (attempt ${emailJob.retries + 1}/${this.maxRetries})`);
        
        // Check if API key exists before attempting to send
        if (!process.env.RESEND_API_KEY) {
          throw new Error('RESEND_API_KEY environment variable not set');
        }
        
        const result = await sendTicketConfirmationEmail(emailJob.data);
        
        if (result.success) {
          console.log(`✅ Email sent successfully to ${emailJob.data.email}`);
          await this.updateEmailTrackingSuccess(emailJob);
        } else {
          await this.updateEmailTrackingFailure(emailJob, result.error);
          this.handleEmailFailure(emailJob, result.error);
        }
              } catch (error) {
          console.error(`❌ Email error for ${emailJob.data.email}:`, error.message);
          emailJob.errors.push({
            timestamp: Date.now(),
            error: error.message
          });
          
          await this.updateEmailTrackingFailure(emailJob, error);
          this.handleEmailFailure(emailJob, error);
        }

      // Enhanced delay based on success/failure
      if (this.queue.length > 0) {
        const delay = this.getDelayForNextEmail(emailJob);
        console.log(`⏱️ Waiting ${delay}ms before next email...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.isProcessing = false;
    console.log(`✅ Email queue processing completed`);
    
    // Log summary if there were failures
    if (this.failedEmails.length > 0) {
      console.log(`⚠️ ${this.failedEmails.length} emails failed permanently and need manual review`);
    }
  }

  // Handle email failures with better retry logic
  handleEmailFailure(emailJob, error) {
    const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
    
    // Check if it's a rate limit error
    const isRateLimit = errorMessage.includes('429') || 
                       errorMessage.includes('rate limit') || 
                       errorMessage.includes('too many requests');
    
    // Check if it's an API key error
    const isAPIKeyError = errorMessage.includes('API key') || 
                         errorMessage.includes('authentication') ||
                         errorMessage.includes('unauthorized');
    
    if (isAPIKeyError) {
      console.error(`🚨 API Key Error - stopping queue processing: ${errorMessage}`);
      this.failedEmails.push({
        ...emailJob,
        failureReason: 'API_KEY_ERROR',
        finalError: errorMessage
      });
      return; // Don't retry API key errors
    }
    
    if (emailJob.retries < this.maxRetries) {
      emailJob.retries++;
      
      // Add extra delay for rate limit errors
      if (isRateLimit) {
        console.log(`⏱️ Rate limit detected, adding extra delay for ${emailJob.data.email}`);
        emailJob.rateLimited = true;
      }
      
      this.queue.unshift(emailJob); // Add back to front of queue
      console.log(`🔄 Retrying email for ${emailJob.data.email} (${emailJob.retries}/${this.maxRetries})`);
    } else {
      console.error(`💀 Email permanently failed for ${emailJob.data.email} after ${this.maxRetries} retries`);
      this.failedEmails.push({
        ...emailJob,
        failureReason: 'MAX_RETRIES_EXCEEDED',
        finalError: errorMessage
      });
    }
  }

  // Calculate delay based on previous email result
  getDelayForNextEmail(previousJob) {
    // If previous job was rate limited, use longer delay
    if (previousJob.rateLimited) {
      return this.rateLimitDelay;
    }
    
    // If previous job failed, use longer delay
    if (previousJob.errors.length > 0) {
      return this.delayBetweenEmails * 2;
    }
    
    return this.delayBetweenEmails;
  }

  // Get queue status with more details
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      failedEmailsCount: this.failedEmails.length,
      oldestJob: this.queue.length > 0 ? this.queue[0].timestamp : null,
      failedEmails: this.failedEmails.map(job => ({
        email: job.data.email,
        failureReason: job.failureReason,
        retries: job.retries,
        lastAttempt: job.lastAttempt,
        errors: job.errors
      }))
    };
  }

  // Get failed emails for admin review
  getFailedEmails() {
    return this.failedEmails;
  }

  // Retry failed emails (admin function)
  retryFailedEmails() {
    if (this.failedEmails.length === 0) {
      console.log('📧 No failed emails to retry');
      return 0;
    }

    const emailsToRetry = this.failedEmails.filter(job => 
      job.failureReason !== 'API_KEY_ERROR'
    );

    emailsToRetry.forEach(job => {
      // Reset retry count and errors
      job.retries = 0;
      job.errors = [];
      job.rateLimited = false;
      delete job.failureReason;
      delete job.finalError;
      
      this.queue.push(job);
    });

    // Remove retried emails from failed list
    this.failedEmails = this.failedEmails.filter(job => 
      job.failureReason === 'API_KEY_ERROR'
    );

    console.log(`🔄 Added ${emailsToRetry.length} failed emails back to queue`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return emailsToRetry.length;
  }

  // Clear queue (for admin use)
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`🧹 Email queue cleared. ${clearedCount} emails removed`);
    return clearedCount;
  }

  // Clear failed emails (for admin use)
  clearFailedEmails() {
    const clearedCount = this.failedEmails.length;
    this.failedEmails = [];
    console.log(`🧹 Failed emails list cleared. ${clearedCount} emails removed`);
    return clearedCount;
  }

  // Update email tracking on success
  async updateEmailTrackingSuccess(emailJob) {
    try {
      if (!emailJob.data.ticketId) return;

      await UserTicket.findByIdAndUpdate(emailJob.data.ticketId, {
        $set: {
          'emailTracking.confirmationEmailSent': true,
          'emailTracking.confirmationEmailSentAt': new Date(),
          'emailTracking.lastEmailError': null,
          'emailTracking.lastEmailErrorAt': null
        },
        $inc: {
          'emailTracking.confirmationEmailAttempts': 1
        },
        $addToSet: {
          'emailTracking.emailQueueJobIds': emailJob.id
        }
      });

      console.log(`📝 Updated email tracking for ticket ${emailJob.data.ticketId} - SUCCESS`);
    } catch (error) {
      console.error(`❌ Failed to update email tracking for ${emailJob.data.ticketId}:`, error.message);
    }
  }

  // Update email tracking on failure
  async updateEmailTrackingFailure(emailJob, error) {
    try {
      if (!emailJob.data.ticketId) return;

      const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';

      await UserTicket.findByIdAndUpdate(emailJob.data.ticketId, {
        $set: {
          'emailTracking.lastEmailError': errorMessage,
          'emailTracking.lastEmailErrorAt': new Date()
        },
        $inc: {
          'emailTracking.confirmationEmailAttempts': 1
        },
        $addToSet: {
          'emailTracking.emailQueueJobIds': emailJob.id
        }
      });

      console.log(`📝 Updated email tracking for ticket ${emailJob.data.ticketId} - FAILURE: ${errorMessage}`);
    } catch (error) {
      console.error(`❌ Failed to update email tracking for ${emailJob.data.ticketId}:`, error.message);
    }
  }
}

// Create singleton instance
const emailQueue = new EmailQueue();

module.exports = emailQueue; 