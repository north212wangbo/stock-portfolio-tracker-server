const { PrismaClient } = require('@prisma/client');
const { comparePassword, generateToken, hashPassword } = require('../utils/auth');
const { generateOTP, sendOTPEmail } = require('../utils/email');

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

    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        let user = await prisma.user.findUnique({
            where: { email }
        });

        const hashedPassword = await hashPassword(password);
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // If user not found, create new unverified user
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    provider: 'local',
                    verified: false,
                    otp,
                    otpExpires: otpExpiry
                }
            });

            // Send OTP email
            const emailResult = await sendOTPEmail(user.email, user.name, otp);
            if (!emailResult.success) {
                console.error('Failed to send OTP email:', emailResult.error);
                return res.status(500).json({ 
                    error: 'Failed to send verification code. Please try again.' 
                });
            }

            return res.status(200).json({
                message: 'Account created. Please check your email for verification code.',
                requiresOTP: true,
                email: user.email
            });
        }

        // For existing verified users, check password and return token
        if (user.verified) {
            const isPasswordValid = await comparePassword(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = generateToken(user.id, user.email);
            return res.status(200).json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    verified: user.verified,
                    avatar: user.avatar
                }
            });
        }

        // If user exists but not verified
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                otp,
                otpExpires: otpExpiry
            }
        });

        const emailResult = await sendOTPEmail(user.email, user.name, otp);
        if (!emailResult.success) {
            console.error('Failed to send OTP email:', emailResult.error);
            return res.status(500).json({ 
                error: 'Failed to send verification code. Please try again.' 
            });
        }

        res.status(200).json({
            message: 'Verification code sent to your email.',
            requiresOTP: true,
            email: user.email
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    } finally {
        await prisma.$disconnect();
    }
};