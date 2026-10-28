#!/bin/sh
# Stop any running production server, then start the current build in the background. For local test runs.
pkill -f "^next-server" 2>/dev/null; pkill -f "^npm exec next" 2>/dev/null; pkill -f "^sh -c next start" 2>/dev/null
sleep 1
setsid nohup npx next start -p "${PORT:-3100}" > /tmp/next.log 2>&1 &
sleep 5
