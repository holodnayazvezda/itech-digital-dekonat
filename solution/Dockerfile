# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY scripts/install-search-model.js ./scripts/
RUN npm run search:install
COPY client ./client
COPY shared ./shared
COPY public ./public
COPY scripts ./scripts
COPY server/assets ./server/assets
COPY index.html vite.config.js ./
ARG LOGIN_MODE=demo
RUN VITE_CAMPUS_AUTH="$LOGIN_MODE" npm run build

FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    CAMPUS_DEMO_DB=/data/campus.sqlite PORT=8080
WORKDIR /app
COPY server/requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt \
    && groupadd --gid 10001 campus \
    && useradd --uid 10001 --gid campus --no-create-home campus \
    && install -d -o campus -g campus -m 0700 /data
COPY server ./server
COPY shared ./shared
COPY --from=frontend /app/server/assets/campus.json ./server/assets/campus.json
COPY --from=frontend /app/dist ./dist
RUN chmod -R a+rX ./dist ./server ./shared
USER campus
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=15s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ['PORT']+'/health', timeout=2).close()"
CMD ["sh", "-c", "exec uvicorn server.web:app --host 0.0.0.0 --port \"$PORT\""]
