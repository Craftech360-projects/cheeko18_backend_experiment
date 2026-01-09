"""
Token Server for LiveKit Push-to-Talk Client

This server provides:
1. Static file serving for the web UI
2. Token generation endpoint for LiveKit authentication
3. Auth status endpoint for spy tools (Gmail, Calendar, GitHub)
4. Google OAuth flow initiation
"""

import os
import uuid
import json
from pathlib import Path
from aiohttp import web
from dotenv import load_dotenv
from livekit import api
import aiohttp_cors


# Project root (one level up from agent/)
PROJECT_ROOT = Path(__file__).parent.parent

# Load environment variables from .env.local
load_dotenv(PROJECT_ROOT / '.env.local')
load_dotenv(PROJECT_ROOT / '.env')

# Configuration - Load from environment variables
LIVEKIT_URL = os.getenv('LIVEKIT_URL')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

# Directory for static files (frontend/)
STATIC_DIR = PROJECT_ROOT / 'frontend'

# Auth file paths
TOKEN_JSON_PATH = PROJECT_ROOT / 'token.json'
CREDENTIALS_JSON_PATH = PROJECT_ROOT / 'credentials.json'


async def get_token(request):
    """Generate a LiveKit access token for the client (GET for backward compatibility)."""
    return await create_token(request, user_data=None)


async def post_token(request):
    """Generate a LiveKit access token with user metadata (POST)."""
    try:
        # Parse JSON body
        data = await request.json()
        user_data = data.get('userDetails')
        return await create_token(request, user_data=user_data)
    except Exception as e:
        print(f"Error parsing request: {e}")
        return web.json_response(
            {'error': f'Failed to parse request: {str(e)}'},
            status=400
        )


async def create_token(request, user_data=None):
    """Create and return a LiveKit access token."""
    if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        return web.json_response(
            {'error': 'LiveKit credentials not configured'},
            status=500
        )

    # Generate unique identity and room for this user session
    session_id = uuid.uuid4().hex[:8]
    identity = f"user-{session_id}"
    room_name = f"cheeko-room-{session_id}"  # Unique room per user!

    # Get user name from metadata or use default
    user_name = "User"
    if user_data and isinstance(user_data, dict):
        user_name = user_data.get("name", "User")
        print(f"Token request with user data: {user_data}")

    # Create access token
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(identity)
    token.with_name(user_name)
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))

    # Include metadata in token if provided - use with_metadata() method
    if user_data and isinstance(user_data, dict):
        metadata_str = json.dumps(user_data)
        token.with_metadata(metadata_str)
        print(f"✅ Set token metadata via with_metadata(): {metadata_str}")
    else:
        print("⚠️ No user_data provided or not a dict for token metadata")

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


async def get_auth_status(request):
    """Check authentication status for all spy tools services."""
    github_connected = bool(GITHUB_TOKEN)

    # Check for Google token - either from env var or file
    google_valid = False
    token_source = None

    # First check env var (for production)
    google_token_env = os.getenv("GOOGLE_TOKEN_JSON")
    if google_token_env:
        try:
            token_data = json.loads(google_token_env)
            google_valid = 'token' in token_data or 'access_token' in token_data
            token_source = "env"
        except Exception:
            pass

    # Then check file (for local dev)
    if not google_valid and TOKEN_JSON_PATH.exists():
        try:
            with open(TOKEN_JSON_PATH) as f:
                token_data = json.load(f)
                google_valid = 'token' in token_data or 'access_token' in token_data
                token_source = "file"
        except Exception:
            pass

    return web.json_response({
        'google': {
            'connected': google_valid,
            'hasCredentials': CREDENTIALS_JSON_PATH.exists() or bool(google_token_env),
            'source': token_source
        },
        'github': {
            'connected': github_connected,
        }
    })


async def start_google_oauth(request):
    """Initiate Google OAuth flow."""
    # Check if already authorized via env var (production)
    google_token_env = os.getenv("GOOGLE_TOKEN_JSON")
    if google_token_env:
        try:
            token_data = json.loads(google_token_env)
            if 'token' in token_data or 'access_token' in token_data:
                return web.json_response({
                    'success': True,
                    'message': 'Google already authorized via environment variable!'
                })
        except Exception:
            pass

    if not CREDENTIALS_JSON_PATH.exists():
        return web.json_response({
            'error': 'OAuth not available in production. Token must be set via GOOGLE_TOKEN_JSON environment variable.',
            'hint': 'Run locally first to generate token.json, then set GOOGLE_TOKEN_JSON on Railway.'
        }, status=400)

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow

        SCOPES = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/calendar.readonly'
        ]

        flow = InstalledAppFlow.from_client_secrets_file(
            str(CREDENTIALS_JSON_PATH),
            SCOPES
        )

        # Run local server for OAuth callback
        creds = flow.run_local_server(port=0)

        # Save the credentials
        with open(TOKEN_JSON_PATH, 'w') as token:
            token.write(creds.to_json())

        return web.json_response({
            'success': True,
            'message': 'Google authorization successful!'
        })

    except Exception as e:
        return web.json_response({
            'error': f'OAuth flow failed: {str(e)}'
        }, status=500)


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

    # Token endpoint - supports both GET and POST
    resource_get = app.router.add_get('/api/token', get_token)
    resource_post = app.router.add_post('/api/token', post_token)
    cors.add(resource_get)
    cors.add(resource_post)

    # Auth status endpoint
    auth_status = app.router.add_get('/api/auth/status', get_auth_status)
    cors.add(auth_status)

    # Google OAuth endpoint
    google_oauth = app.router.add_post('/api/auth/google', start_google_oauth)
    cors.add(google_oauth)

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
