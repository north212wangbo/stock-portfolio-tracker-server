const { PrismaClient } = require('@prisma/client');
const { verifyGoogleToken, generateToken } = require('../utils/auth');
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

    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: 'Google ID token is required' });
    }

    try {
        const googleUser = await verifyGoogleToken(idToken);
        
        if (!googleUser) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }

        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: googleUser.email },
                    {
                        AND: [
                            { provider: 'google' },
                            { providerId: googleUser.providerId }
                        ]
                    }
                ]
            }
        });

        if (user) {
            if (user.provider !== 'google') {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        provider: 'google',
                        providerId: googleUser.providerId,
                        avatar: googleUser.avatar,
                        verified: googleUser.verified
                    }
                });
            }
        } else {
            user = await prisma.user.create({
                data: {
                    email: googleUser.email,
                    name: googleUser.name,
                    provider: 'google',
                    providerId: googleUser.providerId,
                    avatar: googleUser.avatar,
                    verified: googleUser.verified
                }
            });

            // Send welcome email for new users
            const welcomeResult = await sendWelcomeEmail(user.email, user.name);
            if (!welcomeResult.success) {
                console.error('Failed to send welcome email:', welcomeResult.error);
                // Don't fail the login if welcome email fails
            }
        }

        const token = generateToken(user.id, user.email);

        res.status(200).json({
            message: 'Google login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                verified: user.verified,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ error: 'Failed to login with Google' });
    } finally {
        await prisma.$disconnect();
    }
};