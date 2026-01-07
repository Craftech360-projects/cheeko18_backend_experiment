"""
Token Server for LiveKit Push-to-Talk Client

This server provides:
1. Static file serving for the web UI
2. Token generation endpoint for LiveKit authentication
"""

import os
import uuid
from pathlib import Path
from aiohttp import web
from dotenv import load_dotenv
from livekit import api
import aiohttp_cors


# Load environment variables from .env.local
load_dotenv('.env.local')

# Configuration - Load from environment variables
LIVEKIT_URL = os.getenv('LIVEKIT_URL')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')

# Directory for static files
STATIC_DIR = Path(__file__).parent


async def get_token(request):
    """Generate a LiveKit access token for the client."""
    if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        return web.json_response(
            {'error': 'LiveKit credentials not configured'},
            status=500
        )

    # Generate unique identity for this user
    identity = f"user-{uuid.uuid4().hex[:8]}"
    room_name = "cheeko-local-test"  # Local testing room

    # Create access token
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(identity)
    token.with_name("User")
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))

    jwt_token = token.to_jwt()

    # Explicitly dispatch an agent to the room
    try:
        lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk_api.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(room=room_name)
        )
        await lk_api.aclose()
    except Exception as e:
        print(f"Agent dispatch note: {e}")

    return web.json_response({
        'token': jwt_token,
        'url': LIVEKIT_URL,
        'identity': identity,
        'room': room_name,
    })


async def serve_index(request):
    """Serve the index.html file."""
    return web.FileResponse(STATIC_DIR / 'index.html')


def create_app():
    """Create and configure the aiohttp application."""
    app = web.Application()

    # Configure CORS
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
        )
    })

    # Routes
    app.router.add_get('/', serve_index)
    resource = app.router.add_get('/api/token', get_token)
    cors.add(resource)
    
    # Static files (CSS, JS)
    app.router.add_static('/', STATIC_DIR, show_index=False)
    
    return app


if __name__ == '__main__':
    print("=" * 50)
    print("🐵 Cheeko Push-to-Talk Server")
    print("=" * 50)
    
    # Check configuration
    if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        print("\n⚠️  WARNING: LiveKit credentials not configured!")
        print("Please edit .env.local with your credentials:")
        print("  - LIVEKIT_URL")
        print("  - LIVEKIT_API_KEY") 
        print("  - LIVEKIT_API_SECRET")
        print("  - GOOGLE_API_KEY")
        print()
    else:
        print(f"\n✅ LiveKit URL: {LIVEKIT_URL}")
    
    print("\n🌐 Starting server at http://localhost:8000")
    print("   Press Ctrl+C to stop\n")
    
    port = int(os.environ.get('PORT', 8000))
    app = create_app()
    web.run_app(app, host='0.0.0.0', port=port, print=None)
