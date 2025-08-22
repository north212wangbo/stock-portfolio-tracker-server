const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateOTPEmail = (userName, otp) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Your Login Code</title>
        <style>
            body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 40px 30px; }
            .content h2 { color: #333; font-size: 24px; margin-bottom: 20px; }
            .content p { color: #666; line-height: 1.6; margin-bottom: 15px; }
            .otp-container { text-align: center; margin: 35px 0; }
            .otp-code { 
                display: inline-block; 
                padding: 20px 30px; 
                background: #f8f9fa; 
                border: 2px solid #667eea; 
                border-radius: 10px; 
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #333;
                font-family: monospace;
            }
            .footer { 
                background: #f8f9fa; 
                padding: 25px; 
                text-align: center; 
                font-size: 14px; 
                color: #666; 
                border-top: 1px solid #dee2e6;
            }
            .warning { 
                background: #fff3cd; 
                border: 1px solid #ffeaa7; 
                padding: 15px; 
                border-radius: 5px; 
                margin: 20px 0;
                color: #856404;
            }
            @media only screen and (max-width: 600px) {
                .content { padding: 30px 20px; }
                .header { padding: 30px 20px; }
                .header h1 { font-size: 24px; }
                .otp-code { font-size: 28px; letter-spacing: 6px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content">
                <h2>Your Login Code${userName ? `, ${userName}` : ''} 🔐</h2>
                <p>Enter this code to complete your login:</p>
                
                <div class="otp-container">
                    <div class="otp-code">${otp}</div>
                </div>
                
                <div class="warning">
                    <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
                </div>
                
                <p>If you didn't attempt to log in, you can safely ignore this email.</p>
                
                <p>Happy investing! 🚀</p>
            </div>
            
            <div class="footer">
                <p><strong>Your App Name</strong></p>
                <p>© 2025 Your App Name. All rights reserved.</p>
                <p>If you have questions, reply to this email or contact support.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

const sendOTPEmail = async (email, userName, otp) => {
    try {
        const result = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'noreply@example.com',
            to: email,
            subject: 'Your login code',
            html: generateOTPEmail(userName, otp)
        });

        console.log('OTP email sent successfully:', result.id);
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('Failed to send OTP email:', error);
        return { success: false, error: error.message };
    }
};

const generateWelcomeEmail = (userName) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome!</title>
        <style>
            body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 40px 30px; }
            .content h2 { color: #333; font-size: 24px; margin-bottom: 20px; }
            .content p { color: #666; line-height: 1.6; margin-bottom: 15px; }
            .feature-list { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature-item { margin-bottom: 12px; color: #495057; }
            .cta-container { text-align: center; margin: 35px 0; }
            .cta-button { 
                display: inline-block; 
                padding: 15px 40px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white !important; 
                text-decoration: none; 
                border-radius: 50px; 
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            }
            .footer { 
                background: #f8f9fa; 
                padding: 25px; 
                text-align: center; 
                font-size: 14px; 
                color: #666; 
                border-top: 1px solid #dee2e6;
            }
            @media only screen and (max-width: 600px) {
                .content { padding: 30px 20px; }
                .header { padding: 30px 20px; }
                .header h1 { font-size: 24px; }
            }
        </style>
    </head>
    <body>
        <div class="content">
            <p>Hey,</p>
            
            <p>My name is Bo, I started this project because I wanted a better place to manage my stock portfolios: investment, retirement, crypto, etc. A simple, fast and unified interface that just works. I hope it will work for you, too</p>
            
            <p><strong>Here are the basics to get started:</strong></p>
            
            <div class="feature-list">
                <div class="feature-item"><strong>1.</strong> Create your first portfolio and give it a name.</div>
                <div class="feature-item"><strong>2.</strong> Add a transaction to the portfolio, if you have the accurate date/price of the transaction, perfect, it will give you a better performance overview. If not, don't worry, you can add them later.</div>
                <div class="feature-item"><strong>3.</strong> You are almost there! Your portfolio is simply made of a series of transactions over the history. Keep adding transactions and explore the rest of the app.</div>
            </div>
            
            <p>Questions and feedbacks? Reply to this email and let me know. I read and reply to every email.</p>
            
            <p>Cheers,<br><strong>Bo</strong></p>
        </div>
    </body>
    </html>
    `;
};

const sendWelcomeEmail = async (email, userName) => {
    try {
        const result = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'noreply@example.com',
            to: email,
            subject: 'Welcome!',
            html: generateWelcomeEmail(userName)
        });

        console.log('Welcome email sent successfully:', result.id);
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    generateOTP,
    sendOTPEmail,
    sendWelcomeEmail
};