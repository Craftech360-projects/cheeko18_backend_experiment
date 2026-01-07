# Push-to-Talk (PTT) Configuration Guide

This document explains how Push-to-Talk functionality was implemented in the Cheeko voice assistant.

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Configuration Details](#configuration-details)
- [Key Implementation Decisions](#key-implementation-decisions)
- [Troubleshooting](#troubleshooting)

---

## Overview

Push-to-Talk (PTT) allows users to control when they're speaking by holding down a button. When the button is **pressed**, the microphone is unmuted and audio is streamed. When **released**, the microphone is muted.

### User Experience Flow

```
1. User clicks "Start Talking" → Connects to LiveKit room
2. User holds PTT button → Microphone unmutes
3. User speaks → Audio streams to agent
4. User releases button → Microphone mutes
5. Gemini detects end of speech → Generates response
6. Agent streams audio response back → User hears Cheeko
```

---

## Architecture

### Component Diagram

```
┌─────────────────┐
│   Browser UI    │
│  (index.html)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  LiveKit Client │ ◄─────► │  LiveKit Room    │
│   (index.js)    │  WebRTC │   (Cloud)        │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  LiveKit Agent   │
                            │   (agent.py)     │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Gemini Live API │
                            │  (Google)        │
                            └──────────────────┘
```

---

## Configuration Details

### 1. Client-Side Configuration (index.js)

#### Audio Track Setup

```javascript
// Create local audio track (muted by default)
localAudioTrack = await createLocalAudioTrack({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
});

// Start muted - we'll unmute on PTT
await localAudioTrack.mute();
await room.localParticipant.publishTrack(localAudioTrack);
```

**Key Settings:**
- `echoCancellation: true` - Prevents echo from speakers
- `noiseSuppression: true` - Reduces background noise
- `autoGainControl: true` - Normalizes audio levels
- **Initially muted** - PTT pattern requires manual unmute

#### PTT Button Event Handlers

```javascript
// Mouse events
pttButton.addEventListener('mousedown', startRecording);
pttButton.addEventListener('mouseup', stopRecording);

// Touch events (mobile support)
pttButton.addEventListener('touchstart', startRecording);
pttButton.addEventListener('touchend', stopRecording);

// Keyboard support (spacebar)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && room) {
        startRecording();
    }
});
```

#### Audio Control Functions

```javascript
async function startRecording() {
    await localAudioTrack.unmute();  // Start streaming audio
}

async function stopRecording() {
    await localAudioTrack.mute();    // Stop streaming audio
}
```

#### Echo Prevention

```javascript
// Only play audio from REMOTE participants (agent), not from ourselves
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === Track.Kind.Audio && !participant.isLocal) {
        const audioElement = track.attach();
        document.body.appendChild(audioElement);
    }
});
```

**Critical:** The `!participant.isLocal` check prevents hearing your own voice back.

---

### 2. Agent-Side Configuration (agent.py)

#### Gemini Realtime Model Setup

```python
session = AgentSession(
    llm=google.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-09-2025",
        voice="Zephyr",
        temperature=0.8,
        modalities=["AUDIO"],
        _gemini_tools=[types.GoogleSearch()],
    )
)
```

**Key Configuration:**
- `model`: Gemini 2.5 Flash with native audio support
- `voice`: "Zephyr" - kid-friendly voice
- `modalities=["AUDIO"]`: Audio-only mode (no video)
- `_gemini_tools`: Enables Google Search for real-time queries

#### Important: Gemini VAD Configuration

**We keep Gemini's built-in VAD (Voice Activity Detection) ENABLED.**

```python
# NO automatic_activity_detection disabling needed for PTT
# Gemini's VAD is used to detect when speech ends
```

---

## Key Implementation Decisions

### 1. Why Keep Gemini VAD Enabled?

Initially, we considered disabling Gemini's VAD for PTT mode, but this caused issues:

**❌ VAD Disabled:**
- Agent receives audio while button is held
- Agent doesn't know when to respond
- No response generated even after button release

**✅ VAD Enabled (Current Implementation):**
- Agent receives audio while button is held
- When button is released → mic mutes
- Gemini's VAD detects silence → triggers response
- Clean turn-taking behavior

### 2. PTT Control Flow

```
User Action         Audio State         Gemini State
─────────────────   ───────────────     ─────────────────
Button DOWN    →    Mic UNMUTED    →    Receiving audio
                    Streaming...        Listening...
                    
Button UP      →    Mic MUTED      →    Detects silence
                    Silent              VAD triggers turn end
                    
                                   →    Generates response
                                        Streams audio back
```

### 3. Audio Format Handling

LiveKit automatically handles audio format conversion:

| Layer | Format |
|-------|--------|
| Browser Microphone | Raw browser audio (varies) |
| LiveKit Client | Opus codec (WebRTC) |
| LiveKit Room | Opus packets |
| Agent | PCM 16-bit (LiveKit handles conversion) |
| Gemini | 16kHz PCM (plugin handles resampling) |

**No manual audio format configuration needed** - LiveKit Agents framework handles it.

---

## Troubleshooting

### Issue: Hearing Echo of Your Own Voice

**Cause:** Playing back audio from local participant

**Solution:** Check for `!participant.isLocal` filter:
```javascript
if (track.kind === Track.Kind.Audio && !participant.isLocal) {
    // Only attach remote audio
}
```

### Issue: No Response After Releasing Button

**Cause:** Gemini VAD might be disabled

**Solution:** Ensure `automatic_activity_detection` is NOT set to `disabled`:
```python
# Don't do this for PTT:
# realtime_input_config=types.RealtimeInputConfig(
#     automatic_activity_detection=types.AutomaticActivityDetection(
#         disabled=True,
#     ),
# )
```

### Issue: Agent Not Connecting

**Cause:** Environment variables not loaded

**Solution:** Hardcode credentials or verify `.env.local`:
```python
os.environ['LIVEKIT_URL'] = 'wss://your-project.livekit.cloud'
os.environ['LIVEKIT_API_KEY'] = 'your-key'
os.environ['LIVEKIT_API_SECRET'] = 'your-secret'
os.environ['GOOGLE_API_KEY'] = 'your-google-key'
```

### Issue: Connection Failed in Browser

**Cause:** Token server not dispatching agent

**Solution:** Ensure explicit agent dispatch in `server.py`:
```python
lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
await lk_api.agent_dispatch.create_dispatch(
    api.CreateAgentDispatchRequest(room=room_name)
)
```

---

## Performance Optimizations

### 1. Response Time

To optimize latency:
- ✅ Use `temperature=0.8` for faster generation
- ✅ Keep prompts concise (2-3 sentences)
- ✅ Use native audio model (no TTS overhead)

### 2. Audio Quality

Optimized settings:
```javascript
echoCancellation: true,    // Prevents feedback
noiseSuppression: true,    // Cleaner input
autoGainControl: true,     // Consistent volume
```

### 3. Network Efficiency

- LiveKit uses Opus codec (efficient compression)
- WebRTC handles packet loss gracefully
- Adaptive bitrate based on connection

---

## Advanced: Custom Turn Detection

If you need manual turn detection instead of Gemini's VAD:

```python
from livekit.plugins.turn_detector.multilingual import MultilingualModel

session = AgentSession(
    turn_detection=MultilingualModel(),
    llm=google.realtime.RealtimeModel(
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True,
            ),
        ),
        input_audio_transcription=None,
        stt="assemblyai/universal-streaming",
    )
)
```

**Note:** Requires separate STT model for transcription.

---

## References

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [LiveKit JavaScript SDK](https://docs.livekit.io/client-sdk-js/)
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live)
- [WebRTC Audio Constraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)

---

**Last Updated:** December 7, 2025  
**Version:** 1.0
