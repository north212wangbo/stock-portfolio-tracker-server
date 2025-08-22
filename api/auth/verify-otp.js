const { PrismaClient } = require('@prisma/client');
const { generateToken } = require('../utils/auth');
const { sendWelcomeEmail } = require('../utils/email');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Handle CORS headers for all requests
    const allowedOrigins = [
        'http://localhost:3000'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    try {
        // Find user by email and valid OTP
        const user = await prisma.user.findFirst({
            where: {
                email,
                otp,
                otpExpires: {
                    gt: new Date() // OTP not expired
                }
            }
        });

        if (!user) {
            return res.status(400).json({ 
                error: 'Invalid or expired OTP' 
            });
        }

        // Check if user was previously unverified (first time verification)
        const isFirstTimeVerification = !user.verified;

        // Clear OTP and mark as verified
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                verified: true,
                otp: null,
                otpExpires: null
            }
        });

        // Send welcome email for first-time verification
        if (isFirstTimeVerification) {
            const welcomeResult = await sendWelcomeEmail(updatedUser.email, updatedUser.name);
            if (!welcomeResult.success) {
                console.error('Failed to send welcome email:', welcomeResult.error);
                // Don't fail the verification if welcome email fails
            }
        }

        // Generate JWT token for login
        const token = generateToken(updatedUser.id, updatedUser.email);

        res.status(200).json({
            message: 'Email verified successfully. You are now logged in.',
            token,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                verified: updatedUser.verified,
                avatar: updatedUser.avatar
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    } finally {
        await prisma.$disconnect();
    }
};