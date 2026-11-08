#!/bin/bash
# Starts the dev server if it is not running, waits until it responds,
# then runs the given command. Usage: bash scripts/with-server.sh <command...>
set -u
cd /home/z/my-project

if ! curl -s -o /dev/null --max-time 2 http://localhost:3000/; then
  echo "[with-server] starting dev server..."
  setsid nohup bun run dev > /dev/null 2>&1 < /dev/null &
  for i in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then
      echo "[with-server] server ready"
      break
    fi
    sleep 1
  done
fi

"$@"
