#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Install backend Python dependencies
if [ -f backend/requirements.txt ]; then
  python -m pip install --upgrade pip
  python -m pip install -r backend/requirements.txt
fi

# Build frontend
if [ -f frontend/package.json ]; then
  cd frontend
  npm ci
  npm run build
  cd "$ROOT_DIR"
fi

# Apply Django migrations
cd backend
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Start Django with Gunicorn on the configured port
PORT="${PORT:-8000}"
exec gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT}
