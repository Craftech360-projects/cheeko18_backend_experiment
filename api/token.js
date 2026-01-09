const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const LIVEKIT_URL = process.env.LIVEKIT_URL;
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        return res.status(500).json({ error: 'LiveKit credentials not configured' });
    }

    try {
        const userDetails = req.body?.userDetails || {};
        const sessionId = Math.random().toString(36).substring(2, 10);
        const identity = `user-${sessionId}`;
        const roomName = `cheeko-room-${sessionId}`;  // Unique room per user!
        const userName = userDetails.name || 'User';

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            exp: now + 3600,
            iss: LIVEKIT_API_KEY,
            nbf: now - 10,
            sub: identity,
            name: userName,
            video: {
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            }
        };

        // Add metadata if provided
        if (userDetails && Object.keys(userDetails).length > 0) {
            payload.metadata = JSON.stringify(userDetails);
        }

        const token = jwt.sign(payload, LIVEKIT_API_SECRET, { algorithm: 'HS256' });

        return res.status(200).json({
            token,
            url: LIVEKIT_URL,
            identity,
            room: roomName,
        });
    } catch (error) {
        console.error('Token generation error:', error);
        return res.status(500).json({ error: 'Token generation failed' });
    }
}
