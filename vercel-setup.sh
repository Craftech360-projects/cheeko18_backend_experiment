#!/bin/bash

echo "🚀 Vercel Deployment Setup"
echo "=========================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
else
    echo "✅ Vercel CLI already installed"
fi

echo ""
echo "🔐 You'll need to set these environment variables in Vercel:"
echo "   - LIVEKIT_URL"
echo "   - LIVEKIT_API_KEY"  
echo "   - LIVEKIT_API_SECRET"
echo ""
echo "To deploy:"
echo "1. Run: vercel"
echo "2. Follow the prompts"
echo "3. Set environment variables: vercel env add LIVEKIT_URL"
echo "4. Deploy to production: vercel --prod"
echo ""
echo "⚠️  Important: You still need to deploy agent.py separately!"
echo "   Recommended platforms: Fly.io, Railway, or DigitalOcean"
echo ""
echo "📖 Read VERCEL_DEPLOYMENT.md for full instructions"
