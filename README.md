# Cheeko - AI Voice Assistant with Push-to-Talk 🐵

A real-time voice AI assistant built with LiveKit and Google Gemini, featuring a modern Push-to-Talk web interface.

## Features

- 🎤 **Push-to-Talk Interface** - Hold button or spacebar to talk
- 🤖 **Google Gemini 2.0** - Powered by Gemini's real-time voice API
- 🔍 **Google Search Integration** - Agent can search the web for current information
- 🎨 **Modern UI** - Dark mode with glassmorphism and smooth animations
- 📱 **Mobile Support** - Touch-friendly interface
- 🌐 **Real-time Communication** - Low-latency audio streaming via LiveKit

## Prerequisites

- **Python 3.9+** (Python 3.10+ recommended)
- **Google API Key** - Get from [Google AI Studio](https://aistudio.google.com/apikey)
- **LiveKit Cloud Account** - Sign up at [LiveKit Cloud](https://cloud.livekit.io)

## Installation

### 1. Clone or Navigate to Project

```bash
cd /Users/abrahamaltioai/Documents/gemini_livekit
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Edit `.env.local` with your credentials:

```bash
# LiveKit Cloud Credentials (from https://cloud.livekit.io -> Settings -> Keys)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Google Gemini API Key (from https://aistudio.google.com/apikey)
GOOGLE_API_KEY=your-google-api-key
```

## Running the Application

You need to run **two processes** in separate terminal windows:

### Terminal 1: Start the LiveKit Agent

```bash
cd /Users/abrahamaltioai/Documents/gemini_livekit
source venv/bin/activate
python agent.py dev
```

**Expected output:**
```
INFO   livekit.agents     starting worker
INFO   livekit.agents     registered worker
```

### Terminal 2: Start the Web Server

```bash
cd /Users/abrahamaltioai/Documents/gemini_livekit
source venv/bin/activate
python server.py
```

**Expected output:**
```
🐵 Cheeko Push-to-Talk Server
✅ LiveKit URL: wss://your-project.livekit.cloud
🌐 Starting server at http://localhost:8000
```

### 3. Open the Web Interface

Open your browser and navigate to:

```
http://localhost:8000
```

## Using the Push-to-Talk Interface

1. **Click "🎙️ Start Talking"** to connect to the room
2. **Wait for "Connected to Cheeko!"** status
3. **Hold down the purple button** (or press **Space bar**) to talk
4. **Release** when you're done speaking
5. **Cheeko will respond** with voice

### Controls

- **Mouse**: Click and hold the button
- **Keyboard**: Hold Space bar
- **Mobile**: Touch and hold the button

### Visual Feedback

- **Purple glow + animated rings** = Recording your voice
- **Green status dot** = Connected
- **Yellow status dot** = Connecting
- **Red status dot** = Error

## Project Structure

```
gemini_livekit/
├── agent.py              # LiveKit agent with Gemini integration
├── server.py             # Token server for web client
├── index.html            # Web UI structure
├── index.css             # Styling and animations
├── index.js              # LiveKit client logic
├── requirements.txt      # Python dependencies
├── .env.local           # Environment variables (not in git)
└── README.md            # This file
```

## How It Works

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │ ◄─────► │ LiveKit Room │ ◄─────► │    Agent    │
│  (Web UI)   │         │   (Cloud)    │         │  (Python)   │
└─────────────┘         └──────────────┘         └─────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────┐
                                                  │   Gemini    │
                                                  │  Live API   │
                                                  └─────────────┘
```

### Flow

1. **User clicks "Start Talking"**
   - Browser requests access token from `server.py`
   - Browser connects to LiveKit room
   - Agent automatically joins the room

2. **User holds PTT button**
   - Microphone unmutes
   - Audio streams to LiveKit room
   - Agent receives audio and forwards to Gemini

3. **User releases PTT button**
   - Microphone mutes
   - Gemini's VAD detects end of speech
   - Gemini generates response
   - Agent streams audio back to browser

## Customization

### Change Agent Personality

Edit the `instructions` in `agent.py` (lines 24-92) to customize Cheeko's personality, tone, and behavior.

### Change Voice

Edit `voice` parameter in `agent.py` (line 15):

```python
voice="Zephyr",  # Options: Puck, Charon, Kore, Fenrir, Aoede
```

See [Gemini voices](https://ai.google.dev/gemini-api/docs/live#change-voices) for all options.

### Change Model

Edit `model` parameter in `agent.py` (line 14):

```python
model="gemini-2.0-flash-exp",
```

### Disable Google Search

Remove the `_gemini_tools` parameter in `agent.py` (line 19):

```python
# Remove this line:
_gemini_tools=[types.GoogleSearch()],
```

## Troubleshooting

### "Connection failed" in browser

- ✅ Check that `python agent.py dev` is running
- ✅ Check that `python server.py` is running
- ✅ Verify `.env.local` has correct credentials

### No audio response

- ✅ Check browser console for errors (F12 → Console)
- ✅ Ensure `GOOGLE_API_KEY` is set correctly
- ✅ Check Mac volume is not muted
- ✅ Look for "🔊 Agent audio element attached" in console

### Agent won't start

- ✅ Activate virtual environment: `source venv/bin/activate`
- ✅ Check `.env.local` exists and has all variables
- ✅ Verify LiveKit credentials are correct

### Python version warnings

If you see warnings about Python 3.9, consider upgrading:

```bash
# Install Python 3.10+ via Homebrew
brew install python@3.11

# Recreate virtual environment
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Development

### Running in Production

For production deployment, consider:

1. **Deploy agent to LiveKit Cloud** - See [LiveKit Cloud Deployment](https://docs.livekit.io/agents/ops/deployment/)
2. **Use environment variables** instead of `.env.local`
3. **Add HTTPS** to web server
4. **Implement user authentication**

### Logs

- **Agent logs**: Terminal running `python agent.py dev`
- **Server logs**: Terminal running `python server.py`
- **Browser logs**: Browser console (F12 → Console)

## Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live)
- [LiveKit JavaScript SDK](https://docs.livekit.io/client-sdk-js/)

## License

This project is for educational and development purposes.

## Support

For issues or questions:
- LiveKit: [LiveKit Discord](https://livekit.io/discord)
- Gemini: [Google AI Forum](https://discuss.ai.google.dev/)

---

**Built with ❤️ using LiveKit and Google Gemini**
