#!/bin/bash

echo "🛑 Killing background processes for web-sandbox repo..."

# Kill processes by PID if they contain web-sandbox in the command
echo "Killing web-sandbox specific processes..."
ps aux | grep "web-sandbox" | grep -v grep | awk '{print $2}' | xargs -r kill -TERM 2>/dev/null

# Kill processes using ports 3000 and 3001 (common dev server ports)
echo "Killing processes on ports 3000 and 3001..."
lsof -ti :3000 | xargs -r kill -TERM 2>/dev/null
lsof -ti :3001 | xargs -r kill -TERM 2>/dev/null

# Kill any nest start --watch processes
echo "Killing nest start --watch processes..."
pkill -f "nest start --watch" 2>/dev/null

# Kill any pnpm dev processes in current directory
echo "Killing pnpm dev processes..."
pkill -f "pnpm.*dev" 2>/dev/null

# Kill any npm run start:dev processes
echo "Killing npm run start:dev processes..."
pkill -f "npm run start:dev" 2>/dev/null

# Wait a moment for graceful shutdown
sleep 2

# Force kill if processes are still running
echo "Force killing any remaining processes..."
ps aux | grep "web-sandbox" | grep -v grep | awk '{print $2}' | xargs -r kill -KILL 2>/dev/null
lsof -ti :3000 | xargs -r kill -KILL 2>/dev/null
lsof -ti :3001 | xargs -r kill -KILL 2>/dev/null

echo "✅ Process cleanup complete!"
echo ""
echo "To verify all processes are killed, run:"
echo "  ps aux | grep web-sandbox"
echo "  lsof -i :3000 -i :3001"