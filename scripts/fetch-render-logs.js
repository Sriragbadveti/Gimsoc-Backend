#!/usr/bin/env node

/**
 * Render Log Fetcher for Email Analysis
 * 
 * This script fetches logs from Render and extracts email-related information
 * 
 * Usage:
 * node scripts/fetch-render-logs.js [service-id] [hours-back]
 * 
 * Environment Variables Required:
 * - RENDER_API_KEY: Your Render API key
 * - RENDER_SERVICE_ID: Your service ID (optional, can be passed as argument)
 */

require('dotenv').config();
const https = require('https');
const EmailLogger = require('../utils/emailLogger');

class RenderLogFetcher {
  constructor(apiKey, serviceId) {
    this.apiKey = apiKey;
    this.serviceId = serviceId;
    this.baseUrl = 'api.render.com';
  }

  // Fetch logs from Render API
  async fetchLogs(hoursBack = 24) {
    return new Promise((resolve, reject) => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (hoursBack * 60 * 60 * 1000));
      
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/v1/services/${this.serviceId}/logs?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      };

      console.log(`🔍 Fetching logs from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      console.log(`📡 URL: https://${this.baseUrl}${options.path}`);

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const logs = JSON.parse(data);
              resolve(logs);
            } catch (error) {
              reject(new Error(`Failed to parse JSON response: ${error.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  // Extract log text from Render log response
  extractLogText(renderLogs) {
    if (!renderLogs || !Array.isArray(renderLogs)) {
      return '';
    }

    return renderLogs
      .map(log => log.message || log.log || '')
      .join('\n');
  }

  // Analyze logs and generate report
  async generateEmailReport(hoursBack = 24) {
    try {
      console.log('🚀 Starting Render log analysis...');
      
      // Fetch logs from Render
      const renderLogs = await this.fetchLogs(hoursBack);
      console.log(`📥 Fetched ${renderLogs.length} log entries`);

      // Extract log text
      const logText = this.extractLogText(renderLogs);
      console.log(`📝 Extracted ${logText.split('\n').length} lines of log text`);

      // Extract email logs
      const emailLogs = EmailLogger.extractEmailLogs(logText);
      console.log(`📧 Found ${emailLogs.length} email log entries`);

      if (emailLogs.length === 0) {
        console.log('⚠️ No email logs found in the fetched logs');
        return {
          success: true,
          message: 'No email logs found',
          emailLogs: [],
          summary: null
        };
      }

      // Analyze email logs
      const analysis = EmailLogger.analyzeEmailLogs(emailLogs);

      // Generate report
      const report = {
        success: true,
        fetchedAt: new Date().toISOString(),
        timeRange: {
          hoursBack,
          startTime: new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString(),
          endTime: new Date().toISOString()
        },
        totalLogEntries: renderLogs.length,
        emailLogEntries: emailLogs.length,
        summary: analysis,
        emailLogs: emailLogs
      };

      return report;

    } catch (error) {
      console.error('❌ Error generating email report:', error.message);
      return {
        success: false,
        error: error.message,
        emailLogs: [],
        summary: null
      };
    }
  }

  // Print summary report to console
  printSummary(report) {
    if (!report.success) {
      console.log('\n❌ Report Generation Failed');
      console.log(`Error: ${report.error}`);
      return;
    }

    const { summary } = report;
    
    console.log('\n📊 EMAIL DELIVERY REPORT');
    console.log('========================');
    console.log(`📅 Time Range: ${report.timeRange.hoursBack} hours back`);
    console.log(`📝 Total Log Entries: ${report.totalLogEntries}`);
    console.log(`📧 Email Log Entries: ${report.emailLogEntries}`);
    
    if (summary) {
      console.log('\n📈 Statistics:');
      console.log(`   Total Emails: ${summary.totalEmails}`);
      console.log(`   Successful: ${summary.successfulEmails} (${summary.successRate})`);
      console.log(`   Failed: ${summary.failedEmails}`);
      console.log(`   Permanent Failures: ${summary.permanentFailures}`);
      console.log(`   Queued: ${summary.queuedEmails}`);
      console.log(`   Retries: ${summary.retries}`);
      console.log(`   Approval Emails: ${summary.approvalEmails}`);
      console.log(`   Rejection Emails: ${summary.rejectionEmails}`);
      console.log(`   API Key Errors: ${summary.apiKeyErrors}`);
      console.log(`   Rate Limits: ${summary.rateLimits}`);

      if (summary.emails.length > 0) {
        console.log('\n📧 Email Details:');
        summary.emails.forEach((email, index) => {
          const status = email.success ? '✅' : (email.permanentFailure ? '❌' : '⏳');
          console.log(`   ${index + 1}. ${status} ${email.email} (${email.fullName})`);
          if (!email.success && email.events.length > 0) {
            const lastEvent = email.events[email.events.length - 1];
            if (lastEvent.error) {
              console.log(`      Error: ${lastEvent.error}`);
            }
          }
        });
      }
    }

    console.log('\n🔗 Full report available via API endpoint: POST /api/admin/analyze-render-logs');
  }
}

// Main execution
async function main() {
  // Get arguments
  const args = process.argv.slice(2);
  const serviceId = args[0] || process.env.RENDER_SERVICE_ID;
  const hoursBack = parseInt(args[1]) || 24;

  // Validate required environment variables
  if (!process.env.RENDER_API_KEY) {
    console.error('❌ RENDER_API_KEY environment variable is required');
    console.log('   Get your API key from: https://dashboard.render.com/account/api-keys');
    process.exit(1);
  }

  if (!serviceId) {
    console.error('❌ Service ID is required');
    console.log('   Usage: node scripts/fetch-render-logs.js <service-id> [hours-back]');
    console.log('   Or set RENDER_SERVICE_ID environment variable');
    console.log('   Find your service ID in the Render dashboard URL');
    process.exit(1);
  }

  // Create fetcher and generate report
  const fetcher = new RenderLogFetcher(process.env.RENDER_API_KEY, serviceId);
  const report = await fetcher.generateEmailReport(hoursBack);
  
  // Print summary
  fetcher.printSummary(report);

  // Save report to file if requested
  if (process.env.SAVE_REPORT === 'true') {
    const fs = require('fs');
    const filename = `email-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to ${filename}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = RenderLogFetcher;