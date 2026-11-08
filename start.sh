#!/usr/bin/env bash
# Zubair Hall Mess Manager - start script (macOS / Linux)
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install the LTS version from https://nodejs.org first."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies (5-10 minutes)..."
  npm install || exit 1
fi

if [ ! -f db/custom.db ]; then
  mkdir -p db
  echo "Creating the database..."
  npx prisma db push || exit 1
fi

if [ ! -f .next/BUILD_ID ]; then
  echo "Building the app..."
  npm run build || exit 1
fi

echo "Starting the server. Keep this window open while using the app."
echo "On this PC:    http://localhost:3000"
echo "On phones:     http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'):3000"
npm start
