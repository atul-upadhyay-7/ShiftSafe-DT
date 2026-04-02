#!/bin/bash
echo "🛡️ ShiftSafe-DT — Setup"
echo "Installing dependencies..."
npm install
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "✅ Created .env.local from .env.example"
fi
echo "✅ Setup complete! Run ./start.sh or npm run dev to start."
