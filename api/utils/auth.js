const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is required');
    process.exit(1);
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const generateToken = (userId, email) => {
    return jwt.sign(
        { userId, email }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
    );
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const verifyGoogleToken = async (token) => {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        return {
            email: payload.email,
            name: payload.name,
            providerId: payload.sub,
            avatar: payload.picture,
            verified: payload.email_verified
        };
    } catch (error) {
        console.error('Google token verification failed:', error);
        return null;
    }
};

const authenticateRequest = async (req) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    return decoded;
};

module.exports = {
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,
    verifyGoogleToken,
    authenticateRequest
};