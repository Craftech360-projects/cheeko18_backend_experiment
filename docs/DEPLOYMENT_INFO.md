# 🚀 Cheeko Deployment Information

## Deployment Status: ✅ COMPLETED & FIXED

### 📦 Vercel Deployment (Frontend/Web Interface)
- **Status**: ✅ Successfully Deployed & Fixed
- **Production URL**: https://geminilivekit-9h14xc0ta-altio-ai-private-limiteds-projects.vercel.app
- **Inspect URL**: https://vercel.com/altio-ai-private-limiteds-projects/gemini_livekit/8N37KFsxVCug8eheDC8H2cCiBxUd
- **Purpose**: Serves the web interface (HTML/CSS/JS) and token generation API
- **API Endpoint**: `/api/token` (Fixed - now working!)


### 🤖 Railway Deployment (Agent Backend)
- **Status**: ⚠️ Deployed (May need environment variable configuration)
- **Production URL**: https://cheeko-adult-production.up.railway.app
- **Project**: Cheeko Adult
- **Environment**: production
- **Purpose**: Runs the LiveKit agent with Gemini Realtime API

---

## 🔧 Required Environment Variables

### For Vercel:
Make sure these are set in your Vercel project settings:
```
LIVEKIT_URL=wss://altio-4owjwzb3.livekit.cloud
LIVEKIT_API_KEY=<your-api-key>
LIVEKIT_API_SECRET=<your-api-secret>
```

### For Railway:
Make sure these are set in your Railway project settings:
```
LIVEKIT_URL=wss://altio-4owjwzb3.livekit.cloud
LIVEKIT_API_KEY=<your-api-key>
LIVEKIT_API_SECRET=<your-api-secret>
GOOGLE_API_KEY=<your-google-api-key>
```

---

## 📝 Next Steps

### 1. Configure Environment Variables on Railway
```bash
railway variables set LIVEKIT_URL="wss://altio-4owjwzb3.livekit.cloud"
railway variables set LIVEKIT_API_KEY="<your-key>"
railway variables set LIVEKIT_API_SECRET="<your-secret>"
railway variables set GOOGLE_API_KEY="<your-google-key>"
```

### 2. Verify Vercel Environment Variables
Go to: https://vercel.com/altio-ai-private-limiteds-projects/gemini_livekit/settings/environment-variables

### 3. Test the Deployment
1. Open the Vercel URL in your browser
2. Click "Connect" to join the room
3. The agent should connect and greet you with Cheeko's personality

---

## 🔄 Redeployment Commands

### To redeploy to Vercel:
```bash
cd /Users/abrahamaltioai/Downloads/gemini_livekit
git add .
git commit -m "Update message"
vercel --prod
```

### To redeploy to Railway:
```bash
cd /Users/abrahamaltioai/Downloads/gemini_livekit
git add .
git commit -m "Update message"
railway up
```

---

## 🐛 Troubleshooting

### If the agent doesn't connect:
1. Check Railway logs: `railway logs`
2. Verify environment variables are set correctly
3. Ensure the LiveKit credentials are valid

### If the web interface doesn't load:
1. Check Vercel deployment logs in the dashboard
2. Verify the token API endpoint is working: `<vercel-url>/api/token`

---

## 📊 Monitoring

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Railway Dashboard**: https://railway.app/dashboard
- **LiveKit Dashboard**: https://cloud.livekit.io/

---

## 🎯 Current Configuration

### Agent Features:
- ✅ Gemini 2.5 Flash Native Audio
- ✅ Fenrir Voice (Deep, Authoritative)
- ✅ Google Search Integration
- ✅ Audio-only mode (prevents visual hallucinations)
- ✅ Updated "Digital Co-Founder" personality
- ✅ Temperature: 0.75 (creative but stable)

### Web Interface:
- ✅ Push-to-Talk functionality
- ✅ LiveKit token generation
- ✅ Real-time audio streaming
- ✅ Responsive design

---

**Last Updated**: 2026-01-07 16:40 IST
**Deployed By**: Abraham (ALTIO AI)
