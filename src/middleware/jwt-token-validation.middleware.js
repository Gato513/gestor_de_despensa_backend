import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../config/dotEnv.config.js';

// Middleware to validate JWT
const jwtTokenValidation = (req, res, next) => {

    // Ignorar solicitudes OPTIONS
    if (req.method === 'OPTIONS') {
        return next();
    }

    const token = req.cookies.access_token;

    // Ensure session object exists
    if (!req.session) {
        req.session = {};
    }

    if (!token) {
        return res.status(403).json({ message: 'Access token is missing' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        req.session.user = decoded;
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }

    next();

};

export { jwtTokenValidation };
