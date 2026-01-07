/**
 * Cheeko Push-to-Talk Client
 * Uses LiveKit for real-time audio communication with the AI agent
 */

// LiveKit client SDK from CDN
import {
    Room,
    RoomEvent,
    Track,
    createLocalAudioTrack,
} from 'https://cdn.jsdelivr.net/npm/livekit-client@2/+esm';

// Configuration
const TOKEN_ENDPOINT = '/api/token';

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const pttContainer = document.getElementById('pttContainer');
const pttButton = document.getElementById('pttButton');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const transcript = document.getElementById('transcript');

// State
let room = null;
let localAudioTrack = null;
let isRecording = false;

/**
 * Update connection status UI
 */
function setStatus(status, message) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = message;
}

/**
 * Update transcript display
 */
function setTranscript(text, isEmpty = false) {
    transcript.textContent = text;
    transcript.className = 'transcript-text' + (isEmpty ? ' empty' : '');
}

/**
 * Fetch access token from the server
 */
async function getToken() {
    try {
        const response = await fetch(TOKEN_ENDPOINT);
        if (!response.ok) {
            throw new Error('Failed to get token');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Token fetch error:', error);
        throw error;
    }
}

/**
 * Connect to the LiveKit room
 */
async function connect() {
    try {
        setStatus('connecting', 'Connecting...');
        connectBtn.disabled = true;

        // Get token from server
        const { token, url } = await getToken();

        // Create room instance
        room = new Room({
            adaptiveStream: true,
            dynacast: true,
        });

        // Set up event handlers
        room.on(RoomEvent.Connected, () => {
            console.log('Connected to room');
            setStatus('connected', 'CHEEKO Online - Awaiting Instructions');
            setTranscript('Awaiting your instructions, Boss. Hold the button to speak. 🎙️', true);

            // Show PTT button, hide connect button
            connectBtn.style.display = 'none';
            pttContainer.style.display = 'block';
            pttButton.disabled = false;
        });

        room.on(RoomEvent.Disconnected, () => {
            console.log('Disconnected from room');
            setStatus('', 'Disconnected');
            handleDisconnect();
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('Track subscribed:', track.kind, 'from', participant.identity);

            // Only handle audio from REMOTE participants (agent), not from ourselves
            if (track.kind === Track.Kind.Audio && !participant.isLocal) {
                const audioElement = track.attach();
                audioElement.id = 'agent-audio';
                audioElement.autoplay = true;
                audioElement.volume = 1.0;
                document.body.appendChild(audioElement);
                console.log('🔊 Agent audio element attached and playing');

                // Force play in case autoplay is blocked
                audioElement.play().catch(e => {
                    console.warn('Autoplay blocked, user interaction needed:', e);
                });
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach(el => el.remove());
        });

        room.on(RoomEvent.DataReceived, (data, participant) => {
            // Handle transcript data from agent if sent
            try {
                const message = JSON.parse(new TextDecoder().decode(data));
                if (message.type === 'transcript' && message.text) {
                    setTranscript(message.text);
                }
            } catch (e) {
                // Not JSON data, ignore
            }
        });

        // Connect to room
        await room.connect(url, token);

        // Create and publish local audio track (muted initially)
        localAudioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        });

        // Start muted - we'll unmute on PTT
        await localAudioTrack.mute();
        await room.localParticipant.publishTrack(localAudioTrack);

        console.log('Audio track published (muted)');

    } catch (error) {
        console.error('Connection error:', error);
        setStatus('error', 'Connection failed');
        setTranscript('Could not connect. Please try again.', true);
        connectBtn.disabled = false;
    }
}

/**
 * Handle disconnect cleanup
 */
function handleDisconnect() {
    if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack = null;
    }
    room = null;
    isRecording = false;

    // Reset UI
    pttContainer.style.display = 'none';
    pttButton.disabled = true;
    pttButton.classList.remove('recording');
    connectBtn.style.display = 'block';
    connectBtn.disabled = false;
}

/**
 * Start recording (on button press)
 */
async function startRecording() {
    if (!localAudioTrack || isRecording) return;

    isRecording = true;
    pttButton.classList.add('recording');
    pttButton.querySelector('.ptt-label').textContent = 'Listening...';

    // Unmute the audio track
    await localAudioTrack.unmute();
    console.log('Started recording');
}

/**
 * Stop recording (on button release)
 */
async function stopRecording() {
    if (!localAudioTrack || !isRecording) return;

    isRecording = false;
    pttButton.classList.remove('recording');
    pttButton.querySelector('.ptt-label').textContent = 'Hold to talk';

    // Mute the audio track
    await localAudioTrack.mute();
    console.log('Stopped recording');
}

// Event Listeners

// Connect button
connectBtn.addEventListener('click', connect);

// Push-to-Talk button - Mouse events
pttButton.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startRecording();
});

pttButton.addEventListener('mouseup', (e) => {
    e.preventDefault();
    stopRecording();
});

pttButton.addEventListener('mouseleave', (e) => {
    // Stop if mouse leaves button while pressed
    if (isRecording) {
        stopRecording();
    }
});

// Push-to-Talk button - Touch events (for mobile)
pttButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startRecording();
});

pttButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopRecording();
});

pttButton.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    stopRecording();
});

// Keyboard support - Space bar for PTT
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && room && !pttButton.disabled) {
        e.preventDefault();
        startRecording();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && room) {
        e.preventDefault();
        stopRecording();
    }
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRecording) {
        stopRecording();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (room) {
        room.disconnect();
    }
});

console.log('Cheeko Push-to-Talk client loaded');
