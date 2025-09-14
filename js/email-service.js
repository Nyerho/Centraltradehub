// Email Service for Registration Notifications
import { API_CONFIG } from './api-config.js';

class EmailService {
    constructor() {
        this.sendGridApiKey = API_CONFIG.apiKeys.SENDGRID_API_KEY;
        this.baseUrl = API_CONFIG.sendgrid.baseUrl;
    }

    async sendWelcomeEmail(userEmail, userName) {
        try {
            const emailData = {
                personalizations: [{
                    to: [{ email: userEmail, name: userName }],
                    subject: 'Welcome to Central Trade Hub - Account Created Successfully'
                }],
                from: {
                    email: 'noreply@centraltradehub.com',
                    name: 'Central Trade Hub'
                },
                content: [{
                    type: 'text/html',
                    value: this.getWelcomeEmailTemplate(userName)
                }]
            };

            const response = await fetch(`${this.baseUrl}/mail/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sendGridApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });

            if (response.ok) {
                console.log('Welcome email sent successfully');
                return { success: true, message: 'Welcome email sent' };
            } else {
                console.error('Failed to send welcome email:', response.statusText);
                return { success: false, message: 'Failed to send welcome email' };
            }
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return { success: false, message: 'Email service error' };
        }
    }

    async sendKYCNotification(userEmail, userName, status) {
        try {
            const emailData = {
                personalizations: [{
                    to: [{ email: userEmail, name: userName }],
                    subject: `KYC Verification ${status === 'pending' ? 'Started' : 'Update'} - Central Trade Hub`
                }],
                from: {
                    email: 'noreply@centraltradehub.com',
                    name: 'Central Trade Hub'
                },
                content: [{
                    type: 'text/html',
                    value: this.getKYCEmailTemplate(userName, status)
                }]
            };

            const response = await fetch(`${this.baseUrl}/mail/send`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sendGridApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });

            if (response.ok) {
                console.log('KYC notification email sent successfully');
                return { success: true, message: 'KYC notification sent' };
            } else {
                console.error('Failed to send KYC notification:', response.statusText);
                return { success: false, message: 'Failed to send KYC notification' };
            }
        } catch (error) {
            console.error('Error sending KYC notification:', error);
            return { success: false, message: 'Email service error' };
        }
    }

    getWelcomeEmailTemplate(userName) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Central Trade Hub</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Central Trade Hub!</h1>
                    <p>Your trading journey starts here</p>
                </div>
                <div class="content">
                    <h2>Hello ${userName},</h2>
                    <p>Congratulations! Your Central Trade Hub account has been created successfully.</p>
                    <p>You now have access to:</p>
                    <ul>
                        <li>Advanced trading platform</li>
                        <li>Real-time market data</li>
                        <li>Professional trading tools</li>
                        <li>24/7 customer support</li>
                    </ul>
                    <p>To get started and unlock all features, we recommend completing your KYC verification:</p>
                    <a href="https://centraltradehub.com/kyc-portal.html" class="button">Complete KYC Verification</a>
                    <p>If you have any questions, our support team is here to help.</p>
                    <p>Happy Trading!<br>The Central Trade Hub Team</p>
                </div>
                <div class="footer">
                    <p>© 2024 Central Trade Hub. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getKYCEmailTemplate(userName, status) {
        const statusMessages = {
            pending: {
                title: 'KYC Verification Started',
                message: 'Your KYC verification process has been initiated and is currently under review.',
                action: 'We will notify you once the verification is complete.'
            },
            verified: {
                title: 'KYC Verification Approved',
                message: 'Congratulations! Your KYC verification has been approved.',
                action: 'You now have access to all platform features.'
            },
            rejected: {
                title: 'KYC Verification Requires Attention',
                message: 'Your KYC verification needs additional information.',
                action: 'Please log in to your account to provide the required documents.'
            }
        };

        const statusInfo = statusMessages[status] || statusMessages.pending;

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${statusInfo.title} - Central Trade Hub</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
                .status-pending { background: #fef3c7; color: #92400e; }
                .status-verified { background: #d1fae5; color: #065f46; }
                .status-rejected { background: #fee2e2; color: #991b1b; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${statusInfo.title}</h1>
                    <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                </div>
                <div class="content">
                    <h2>Hello ${userName},</h2>
                    <p>${statusInfo.message}</p>
                    <p>${statusInfo.action}</p>
                    <a href="https://centraltradehub.com/kyc-portal.html" class="button">View KYC Status</a>
                    <p>If you have any questions about the verification process, please contact our support team.</p>
                    <p>Best regards,<br>The Central Trade Hub Team</p>
                </div>
                <div class="footer">
                    <p>© 2024 Central Trade Hub. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

export default EmailService;