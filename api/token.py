"""
Vercel Serverless Function for LiveKit Token Generation
This replaces the /api/token endpoint from server.py for Vercel deployment
"""

import os
import uuid
import time
import json
import jwt
from http import HTTPStatus


def handler(request):
    """Vercel serverless function handler for token generation."""
    
    # Only allow GET requests
    if request.method != 'GET':
        return {
            'statusCode': HTTPStatus.METHOD_NOT_ALLOWED,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    # Load credentials from environment variables
    LIVEKIT_URL = os.getenv('LIVEKIT_URL')
    LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
    LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
    
    if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        return {
            'statusCode': HTTPStatus.INTERNAL_SERVER_ERROR,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'LiveKit credentials not configured'})
        }
    
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
        response_data = {
            'token': jwt_token,
            'url': LIVEKIT_URL,
            'identity': identity,
            'room': room_name,
        }
        
        return {
            'statusCode': HTTPStatus.OK,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        return {
            'statusCode': HTTPStatus.INTERNAL_SERVER_ERROR,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': f'Token generation failed: {str(e)}'})
        }
