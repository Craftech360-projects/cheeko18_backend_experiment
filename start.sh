#!/bin/bash
# Start both the token server and the LiveKit agent

echo "Starting Cheeko services..."

# Start the agent in background (connects to LiveKit Cloud)
echo "Starting LiveKit agent..."
python agent/agent.py dev &
AGENT_PID=$!

# Give agent time to start
sleep 2

# Start the token server in foreground (handles HTTP requests)
echo "Starting token server on port ${PORT:-8000}..."
python agent/server.py

# If server exits, kill agent
kill $AGENT_PID 2>/dev/null
