const { PrismaClient } = require('@prisma/client');
const { authenticateRequest } = require('../utils/auth');

const prisma = new PrismaClient();

const requireAuth = async (req, res, next) => {
    try {
        const decoded = await authenticateRequest(req);
        
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                verified: true,
                avatar: true
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid token - user not found' });
        }

        req.user = user;
        
        if (next) {
            return next();
        }
        
        return user;
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const withAuth = (handler) => {
    return async (req, res) => {
        // Handle CORS headers for all requests
        const allowedOrigins = [
            'http://localhost:3000'
        ];
        
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        }
        
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Credentials", "true");

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        const user = await requireAuth(req, res);
        
        if (res.headersSent) {
            return;
        }
        
        req.user = user;
        return handler(req, res);
    };
};

module.exports = {
    requireAuth,
    withAuth
};