"""
Vercel Serverless Function for LiveKit Token Generation
This replaces the /api/token endpoint from server.py for Vercel deployment
Uses PyJWT directly to keep the function size small
"""

import os
import uuid
import time
from http.server import BaseHTTPRequestHandler
import json
import jwt


class handler(BaseHTTPRequestHandler):
    """Vercel serverless function handler for token generation."""

    def do_GET(self):
        """Handle GET request for token generation."""
        
        # Load credentials from environment variables
        LIVEKIT_URL = os.getenv('LIVEKIT_URL')
        LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
        LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
        
        if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'LiveKit credentials not configured'
            }).encode())
            return
        
        try:
            # Generate unique identity for this user
            identity = f"user-{uuid.uuid4().hex[:8]}"
            room_name = "cheeko-room"
            
            # Create JWT token manually using PyJWT
            # This matches the LiveKit token format
            now = int(time.time())
            payload = {
                "exp": now + 3600,  # Token expires in 1 hour
                "iss": LIVEKIT_API_KEY,
                "nbf": now - 10,  # Not before (with 10s buffer)
                "sub": identity,
                "name": "User",
                "video": {
                    "roomJoin": True,
                    "room": room_name,
                    "canPublish": True,
                    "canSubscribe": True,
                }
            }
            
            jwt_token = jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")
            
            # Return successful response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response_data = {
                'token': jwt_token,
                'url': LIVEKIT_URL,
                'identity': identity,
                'room': room_name,
            }
            
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': f'Token generation failed: {str(e)}'
            }).encode())
