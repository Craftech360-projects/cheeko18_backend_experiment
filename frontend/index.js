/**
 * Cheeko Push-to-Talk Client
 *
 * Features:
 * 1. Authorization screen for Gmail, Calendar, GitHub
 * 2. LiveKit real-time audio communication with the AI agent
 */

// LiveKit client SDK from CDN
import {
    Room,
    RoomEvent,
    Track,
    createLocalAudioTrack,
} from 'https://cdn.jsdelivr.net/npm/livekit-client@2/+esm';

// Configuration - Railway backend URL
const API_BASE = window.location.hostname === 'localhost'
    ? window.location.origin  // Local development
    : 'https://cheeko-adult-production.up.railway.app';  // Production (Railway)

const TOKEN_ENDPOINT = `${API_BASE}/api/token`;
const AUTH_STATUS_ENDPOINT = `${API_BASE}/api/auth/status`;
const GOOGLE_AUTH_ENDPOINT = `${API_BASE}/api/auth/google`;

// State
let room = null;
let localAudioTrack = null;
let isRecording = false;
let authStatus = {
    google: { connected: false },
    github: { connected: false }
};

// DOM Elements (initialized after DOM load)
let authScreen, mainInterface;
let gmailCard, calendarCard, githubCard;
let gmailStatus, calendarStatus, githubStatus;
let gmailBtn, calendarBtn, githubBtn;
let continueBtn;
let chipGmail, chipCalendar, chipGithub;
let statusDot, statusText, transcript, pttButton;

/**
 * Initialize DOM element references
 */
function initDOMElements() {
    // Auth screen
    authScreen = document.getElementById('authScreen');
    mainInterface = document.getElementById('mainInterface');

    // Service cards
    gmailCard = document.getElementById('gmailCard');
    calendarCard = document.getElementById('calendarCard');
    githubCard = document.getElementById('githubCard');

    // Status badges
    gmailStatus = document.getElementById('gmailStatus');
    calendarStatus = document.getElementById('calendarStatus');
    githubStatus = document.getElementById('githubStatus');

    // Connect buttons
    gmailBtn = document.getElementById('gmailBtn');
    calendarBtn = document.getElementById('calendarBtn');
    githubBtn = document.getElementById('githubBtn');

    // Other elements
    continueBtn = document.getElementById('continueBtn');
    chipGmail = document.getElementById('chipGmail');
    chipCalendar = document.getElementById('chipCalendar');
    chipGithub = document.getElementById('chipGithub');
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    transcript = document.getElementById('transcript');
    pttButton = document.getElementById('pttButton');
}

/**
 * Update service card status UI
 */
function updateServiceStatus(service, connected, message = null) {
    const statusEl = document.getElementById(`${service}Status`);
    const cardEl = document.getElementById(`${service}Card`);
    const btnEl = document.getElementById(`${service}Btn`);

    if (connected) {
        if (statusEl) {
            statusEl.className = 'status-badge connected';
            statusEl.innerHTML = '<span class="status-dot"></span> Connected';
        }
        if (cardEl) cardEl.classList.add('connected');
        if (btnEl) {
            btnEl.textContent = 'Connected';
            btnEl.classList.add('connected');
            btnEl.disabled = true;
        }
    } else {
        if (statusEl) {
            statusEl.className = 'status-badge pending';
            statusEl.innerHTML = `<span class="status-dot"></span> ${message || 'Not connected'}`;
        }
        if (cardEl) cardEl.classList.remove('connected');
        if (btnEl) {
            btnEl.textContent = 'Connect';
            btnEl.classList.remove('connected');
            btnEl.disabled = false;
        }
    }
}

/**
 * Check authentication status for all services
 */
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch(AUTH_STATUS_ENDPOINT);

        if (!response.ok) {
            console.warn('Auth status check failed, using defaults');
            return;
        }

        authStatus = await response.json();
        console.log('Auth status:', authStatus);

        // Update Gmail & Calendar (both use Google OAuth)
        const googleConnected = authStatus.google?.connected || false;
        updateServiceStatus('gmail', googleConnected);
        updateServiceStatus('calendar', googleConnected);

        // Update GitHub
        const githubConnected = authStatus.github?.connected || false;
        updateServiceStatus('github', githubConnected, githubConnected ? null : 'Token configured');

        // If GitHub token exists in env, show as connected
        if (githubConnected) {
            updateServiceStatus('github', true);
        }

    } catch (error) {
        console.error('Error checking auth status:', error);
        // Show as not connected on error
        updateServiceStatus('gmail', false, 'Check failed');
        updateServiceStatus('calendar', false, 'Check failed');
        updateServiceStatus('github', false, 'Check failed');
    }
}

/**
 * Initiate Google OAuth flow
 */
async function connectGoogle() {
    const btn = gmailBtn;
    const originalText = btn?.textContent;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Connecting...';
        }
        if (calendarBtn) {
            calendarBtn.disabled = true;
            calendarBtn.innerHTML = '<span class="spinner"></span> Connecting...';
        }

        console.log('Starting Google OAuth flow...');

        const response = await fetch(GOOGLE_AUTH_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            console.log('Google OAuth successful!');
            // Update both Gmail and Calendar as connected
            updateServiceStatus('gmail', true);
            updateServiceStatus('calendar', true);
            authStatus.google = { connected: true };
        } else {
            console.error('Google OAuth failed:', result.error);
            alert(`Google connection failed: ${result.error}`);
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText || 'Connect';
            }
            if (calendarBtn) {
                calendarBtn.disabled = false;
                calendarBtn.textContent = 'Connect';
            }
        }

    } catch (error) {
        console.error('Google OAuth error:', error);
        alert('Failed to connect to Google. Make sure the server is running.');
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText || 'Connect';
        }
        if (calendarBtn) {
            calendarBtn.disabled = false;
            calendarBtn.textContent = 'Connect';
        }
    }
}

/**
 * Start CHEEKO - switch to main interface and connect
 */
async function startCheeko() {
    console.log('Starting CHEEKO...');

    // Hide auth screen, show main interface
    if (authScreen) authScreen.classList.add('hidden');
    if (mainInterface) mainInterface.classList.add('active');

    // Update service chips based on auth status
    const googleConnected = authStatus.google?.connected || false;
    const githubConnected = authStatus.github?.connected || false;

    if (chipGmail) chipGmail.classList.toggle('inactive', !googleConnected);
    if (chipCalendar) chipCalendar.classList.toggle('inactive', !googleConnected);
    if (chipGithub) chipGithub.classList.toggle('inactive', !githubConnected);

    // Connect to LiveKit
    await connect();
}

/**
 * Update connection status UI
 */
function setStatus(status, message) {
    if (statusDot) statusDot.className = 'status-indicator ' + status;
    if (statusText) statusText.textContent = message;
}

/**
 * Update transcript display
 */
function setTranscript(text, isEmpty = false) {
    if (transcript) {
        transcript.textContent = text;
        transcript.className = 'transcript-text' + (isEmpty ? ' empty' : '');
    }
}

/**
 * Fetch access token from the server
 */
async function getToken() {
    try {
        console.log('Fetching token...');
        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userDetails: { name: 'User' }
            })
        });

        if (!response.ok) {
            throw new Error(`Token endpoint error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token received:', data.identity);
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
        setTranscript('Connecting to CHEEKO...', true);

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
            setStatus('connected', 'CHEEKO Online');
            setTranscript('Ready. Hold the button to speak.', true);
            if (pttButton) pttButton.disabled = false;
        });

        room.on(RoomEvent.Disconnected, () => {
            console.log('Disconnected from room');
            setStatus('', 'Disconnected');
            handleDisconnect();
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('Track subscribed:', track.kind, 'from', participant.identity);

            if (track.kind === Track.Kind.Audio && !participant.isLocal) {
                const audioElement = track.attach();
                audioElement.id = 'agent-audio';
                audioElement.autoplay = true;
                audioElement.volume = 1.0;
                document.body.appendChild(audioElement);
                console.log('Agent audio attached');

                audioElement.play().catch(e => {
                    console.warn('Autoplay blocked:', e);
                });
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach(el => el.remove());
        });

        room.on(RoomEvent.DataReceived, (data, participant) => {
            try {
                const message = JSON.parse(new TextDecoder().decode(data));
                if (message.type === 'transcript' && message.text) {
                    setTranscript(message.text);
                }
            } catch (e) {
                // Not JSON, ignore
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

        await localAudioTrack.mute();
        await room.localParticipant.publishTrack(localAudioTrack);
        console.log('Audio track published (muted)');

    } catch (error) {
        console.error('Connection error:', error);
        setStatus('error', 'Connection failed');
        setTranscript('Could not connect. Please refresh and try again.', true);
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
    if (pttButton) {
        pttButton.disabled = true;
        pttButton.classList.remove('recording');
    }
}

/**
 * Start recording (on button press)
 */
async function startRecording() {
    if (!localAudioTrack || isRecording) return;

    isRecording = true;
    if (pttButton) {
        pttButton.classList.add('recording');
        const label = pttButton.querySelector('.ptt-label');
        if (label) label.textContent = 'Listening...';
    }

    await localAudioTrack.unmute();
    console.log('Started recording');
}

/**
 * Stop recording (on button release)
 */
async function stopRecording() {
    if (!localAudioTrack || !isRecording) return;

    isRecording = false;
    if (pttButton) {
        pttButton.classList.remove('recording');
        const label = pttButton.querySelector('.ptt-label');
        if (label) label.textContent = 'Hold to talk';
    }

    await localAudioTrack.mute();
    console.log('Stopped recording');
}

/**
 * Go back to auth screen
 */
function backToAuth() {
    if (room) {
        room.disconnect();
    }
    handleDisconnect();

    if (mainInterface) mainInterface.classList.remove('active');
    if (authScreen) authScreen.classList.remove('hidden');
}

// Make functions globally available for onclick handlers
window.connectGoogle = connectGoogle;
window.startCheeko = startCheeko;
window.backToAuth = backToAuth;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Cheeko client...');

    // Initialize DOM references
    initDOMElements();

    // Check auth status
    await checkAuthStatus();

    // PTT Button - Mouse events
    if (pttButton) {
        pttButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startRecording();
        });

        pttButton.addEventListener('mouseup', (e) => {
            e.preventDefault();
            stopRecording();
        });

        pttButton.addEventListener('mouseleave', () => {
            if (isRecording) stopRecording();
        });

        // Touch events (mobile)
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
    }

    // Keyboard support - Space bar for PTT
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat && room && pttButton && !pttButton.disabled) {
            if (mainInterface?.classList.contains('active') && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                startRecording();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && room && mainInterface?.classList.contains('active')) {
            if (document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                stopRecording();
            }
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

    console.log('Cheeko client initialized');
});

console.log('Cheeko Push-to-Talk client loaded');
