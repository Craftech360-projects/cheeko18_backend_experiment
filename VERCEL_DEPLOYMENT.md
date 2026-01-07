# Vercel Deployment Guide

## Overview

This application has two components that need different hosting solutions:

1. **Frontend + Token API** → Vercel (this guide)
2. **LiveKit Agent** → Fly.io/Railway/DigitalOcean (separate deployment)

---

## Part 1: Deploy Frontend & API to Vercel

### Step 1: Restructure for Vercel

Create a Vercel serverless function for token generation:

#### Create `vercel.json`:
```json
{
  "buildCommand": null,
  "devCommand": null,
  "installCommand": "pip install -r requirements-vercel.txt",
  "framework": null,
  "outputDirectory": ".",
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

#### Create `requirements-vercel.txt`:
```
livekit
python-dotenv
```

#### Create `api/token.py` (Vercel Serverless Function):
```python
import os
import uuid
from livekit import api

def handler(request):
    """Vercel serverless function for token generation."""
    
    # Load credentials from Vercel environment variables
    LIVEKIT_URL = os.getenv('LIVEKIT_URL')
    LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
    LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')
    
    if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        return {
            'statusCode': 500,
            'body': {'error': 'LiveKit credentials not configured'}
        }
    
    # Generate unique identity
    identity = f"user-{uuid.uuid4().hex[:8]}"
    room_name = "cheeko-room"
    
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
    
    return {
        'statusCode': 200,
        'body': {
            'token': jwt_token,
            'url': LIVEKIT_URL,
            'identity': identity,
            'room': room_name,
        }
    }
```

### Step 2: Update Frontend to Use Vercel API

Update `index.js` to call the Vercel serverless function:

```javascript
// Change the token fetch URL from:
// const response = await fetch('http://localhost:8000/api/token');
// To:
const response = await fetch('/api/token');
```

### Step 3: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 4: Login to Vercel

```bash
vercel login
```

### Step 5: Deploy

```bash
# From your project directory
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? **Select your account**
- Link to existing project? **No**
- Project name? **gemini-livekit** (or your preferred name)
- Directory? **./** (current directory)
- Override settings? **No**

### Step 6: Set Environment Variables in Vercel

After deployment, add your environment variables:

```bash
vercel env add LIVEKIT_URL
# Paste: wss://cheeko-e9fib40x.livekit.cloud

vercel env add LIVEKIT_API_KEY
# Paste your API key

vercel env add LIVEKIT_API_SECRET
# Paste your API secret
```

Or add them via Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`

### Step 7: Redeploy with Environment Variables

```bash
vercel --prod
```

---

## Part 2: Deploy LiveKit Agent (Required!)

⚠️ **Important**: The `agent.py` needs to run continuously and cannot be hosted on Vercel.

### Recommended Platforms:

#### Option A: **Fly.io** (Recommended - Free tier available)

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Create `Dockerfile`:
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY agent.py .
COPY .env.local .

CMD ["python", "agent.py", "start"]
```

3. Deploy:
```bash
fly launch
fly secrets set LIVEKIT_URL="wss://cheeko-e9fib40x.livekit.cloud"
fly secrets set LIVEKIT_API_KEY="your-key"
fly secrets set LIVEKIT_API_SECRET="your-secret"
fly secrets set GOOGLE_API_KEY="your-google-key"
fly deploy
```

#### Option B: **Railway** (Simple, Free tier)

1. Go to [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Deploy

#### Option C: **DigitalOcean App Platform**

1. Go to DigitalOcean → Apps
2. Create new app from GitHub
3. Set as "Worker" type
4. Add environment variables
5. Deploy

---

## Architecture After Deployment

```
[User Browser] 
    ↓
[Vercel - Frontend + Token API]
    ↓
[LiveKit Cloud - wss://cheeko-e9fib40x.livekit.cloud]
    ↑
[Fly.io/Railway - LiveKit Agent (agent.py)]
```

---

## Testing Your Deployment

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Verify the agent is running: Check Fly.io/Railway logs
3. Test the Push-to-Talk functionality

---

## Common Issues

### Issue 1: "Agent not connecting"
- **Solution**: Ensure `agent.py` is running on Fly.io/Railway
- Check agent logs for errors

### Issue 2: "Token generation failed"
- **Solution**: Verify environment variables are set in Vercel
- Check Vercel function logs

### Issue 3: "CORS errors"
- **Solution**: Add CORS headers to `api/token.py` if needed

---

## Alternative: Deploy Everything to Railway/Fly.io

If you prefer a single deployment:

1. Deploy the entire application (frontend + backend + agent) to Railway or Fly.io
2. Keep `server.py` as-is
3. Run both `server.py` and `agent.py` together

This is simpler but won't use Vercel.
