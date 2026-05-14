#!/usr/bin/env sh
set -e

alembic upgrade head
python scripts/create_admin.py
uvicorn app.main:app --host 0.0.0.0 --port 8000
