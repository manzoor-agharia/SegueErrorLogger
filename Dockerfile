# --- Stage 1: build Angular frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build --configuration production

# --- Stage 2: Python backend + static frontend ---
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /frontend/dist/frontend/browser ./app/static

RUN mkdir -p /app/attachments
ENV ATTACHMENTS_DIR=/app/attachments

EXPOSE 8000
CMD alembic upgrade head && python -m app.seed_screens && uvicorn app.main:app --host 0.0.0.0 --port 8000
