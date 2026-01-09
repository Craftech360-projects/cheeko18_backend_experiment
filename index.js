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

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const modalOverlay = document.getElementById('modalOverlay');
    const mainContainer = document.getElementById('mainContainer');
    const userForm = document.getElementById('userForm');
    const submitBtn = document.getElementById('submitBtn');
    const editBtn = document.getElementById('editBtn');
    const displayUserName = document.getElementById('displayUserName');
    const pttButton = document.getElementById('pttButton');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const transcript = document.getElementById('transcript');

    // Debug: Check if elements exist
    console.log('DOM Elements loaded:', {
        modalOverlay: !!modalOverlay,
        mainContainer: !!mainContainer,
        userForm: !!userForm,
        submitBtn: !!submitBtn,
        editBtn: !!editBtn,
        pttButton: !!pttButton
    });

    // State
    let room = null;
    let localAudioTrack = null;
    let isRecording = false;
    let userDetails = null;

    /**
     * Update connection status UI
     */
    function setStatus(status, message) {
        if (statusDot) statusDot.className = 'status-dot ' + status;
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
     * Show the modal form
     */
    function showModal() {
        if (modalOverlay) modalOverlay.classList.remove('hidden');
        if (mainContainer) mainContainer.style.display = 'none';
    }

    /**
     * Hide the modal and show main interface
     */
    function hideModal() {
        console.log('hideModal called');
        if (modalOverlay) {
            console.log('Hiding modal overlay');
            modalOverlay.classList.add('hidden');
        }
        if (mainContainer) {
            console.log('Showing main container');
            mainContainer.style.display = 'flex';
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
                setStatus('connected', 'CHEEKO Online - Awaiting Instructions');
                setTranscript('Awaiting your instructions, Boss. Hold the button to speak.', true);
                if (pttButton) pttButton.disabled = false;
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
                    console.log('Agent audio element attached and playing');

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

            // Connect to room with user metadata
            await room.connect(url, token, {
                metadata: JSON.stringify(userDetails)
            });

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
            if (submitBtn) submitBtn.disabled = false;
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
     * Disconnect and return to form
     */
    function disconnectAndShowForm() {
        if (room) {
            room.disconnect();
        }
        handleDisconnect();
        showModal();
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
        if (pttButton) {
            pttButton.classList.remove('recording');
            const label = pttButton.querySelector('.ptt-label');
            if (label) label.textContent = 'Hold to talk';
        }

        // Mute the audio track
        await localAudioTrack.mute();
        console.log('Stopped recording');
    }

    // Event Listeners

    // Form submission
    if (userForm) {
        console.log('Adding form submit listener');
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submitted!');

            const nameInput = document.getElementById('userName');
            const cityInput = document.getElementById('userCity');
            const professionInput = document.getElementById('userProfession');
            const stateInput = document.getElementById('userState');
            const interestsInput = document.getElementById('userInterests');

            const name = nameInput ? nameInput.value.trim() : '';
            const city = cityInput ? cityInput.value.trim() : '';
            const profession = professionInput ? professionInput.value.trim() : '';

            console.log('Form values:', { name, city, profession });

            if (!name || !city || !profession) {
                alert('Please fill in all required fields (Name, City, and Profession).');
                return;
            }

            console.log('Validation passed, hiding modal...');

            // Store user details
            userDetails = {
                name: name,
                city: city,
                state: stateInput ? stateInput.value.trim() : '',
                profession: profession,
                interests: interestsInput ? interestsInput.value.trim() : ''
            };

            // Update display
            if (displayUserName) displayUserName.textContent = `Welcome, ${name}`;

            // Disable submit button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Connecting...</span>';
            }

            // Hide modal and show main interface
            hideModal();

            // Start connection
            await connect();

            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-icon">🎙️</span><span>Start Talking with CHEEKO</span>';
            }
        });
    }

    // Edit button
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            disconnectAndShowForm();
        });
    }

    // Push-to-Talk button - Mouse events
    if (pttButton) {
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

        // Touch events (for mobile)
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
        // Only trigger PTT if we're in the main interface (not in modal form)
        if (e.code === 'Space' && !e.repeat && room && pttButton && !pttButton.disabled && modalOverlay && modalOverlay.classList.contains('hidden')) {
            // Make sure we're not in an input field
            if (document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                startRecording();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && room && modalOverlay && modalOverlay.classList.contains('hidden')) {
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

    console.log('Cheeko Push-to-Talk client initialized');
});

console.log('Cheeko Push-to-Talk client loaded');
