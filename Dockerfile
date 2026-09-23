# NEWMUX OS — production image (multi-arch: builds natively on arm64 Oracle
# Ampere VMs and on x86). Used by docker-compose.yml.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 newmux && useradd --system --uid 1001 --gid newmux newmux
# Standalone server + static assets + public (includes the generated service worker).
COPY --from=build --chown=newmux:newmux /app/.next/standalone ./
COPY --from=build --chown=newmux:newmux /app/.next/static ./.next/static
COPY --from=build --chown=newmux:newmux /app/public ./public
# Migrations + seed are read from disk at startup.
COPY --from=build --chown=newmux:newmux /app/db ./db
USER newmux
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
