const { sendTicketConfirmationEmail } = require('./emailService');

class EmailQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.delayBetweenEmails = 1000; // 1 second between emails
  }

  // Add email to queue
  addToQueue(emailData) {
    const emailJob = {
      id: Date.now() + Math.random(),
      data: emailData,
      retries: 0,
      timestamp: Date.now()
    };
    
    this.queue.push(emailJob);
    console.log(`📧 Email queued for ${emailData.email}. Queue length: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return emailJob.id;
  }

  // Process the email queue
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Starting email queue processing. ${this.queue.length} emails in queue`);

    while (this.queue.length > 0) {
      const emailJob = this.queue.shift();
      
      try {
        console.log(`📧 Sending email to ${emailJob.data.email} (attempt ${emailJob.retries + 1})`);
        
        const result = await sendTicketConfirmationEmail(emailJob.data);
        
        if (result.success) {
          console.log(`✅ Email sent successfully to ${emailJob.data.email}`);
        } else {
          console.error(`❌ Email failed for ${emailJob.data.email}:`, result.error);
          
          // Retry if under max retries
          if (emailJob.retries < this.maxRetries) {
            emailJob.retries++;
            this.queue.unshift(emailJob); // Add back to front of queue
            console.log(`🔄 Retrying email for ${emailJob.data.email} (${emailJob.retries}/${this.maxRetries})`);
          } else {
            console.error(`💀 Email permanently failed for ${emailJob.data.email} after ${this.maxRetries} retries`);
          }
        }
      } catch (error) {
        console.error(`❌ Email error for ${emailJob.data.email}:`, error.message);
        
        // Retry if under max retries
        if (emailJob.retries < this.maxRetries) {
          emailJob.retries++;
          this.queue.unshift(emailJob); // Add back to front of queue
          console.log(`🔄 Retrying email for ${emailJob.data.email} (${emailJob.retries}/${this.maxRetries})`);
        } else {
          console.error(`💀 Email permanently failed for ${emailJob.data.email} after ${this.maxRetries} retries`);
        }
      }

      // Delay between emails to avoid rate limits
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenEmails));
      }
    }

    this.isProcessing = false;
    console.log(`✅ Email queue processing completed`);
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      oldestJob: this.queue.length > 0 ? this.queue[0].timestamp : null
    };
  }

  // Clear queue (for admin use)
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`🧹 Email queue cleared. ${clearedCount} emails removed`);
    return clearedCount;
  }
}

// Create singleton instance
const emailQueue = new EmailQueue();

module.exports = emailQueue; 