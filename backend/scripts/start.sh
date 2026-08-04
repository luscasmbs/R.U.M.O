#!/usr/bin/env sh
set -e

alembic upgrade head
python -m scripts.create_admin
uvicorn app.main:app --host 0.0.0.0 --port 8000
