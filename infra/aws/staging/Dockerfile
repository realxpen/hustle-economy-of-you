# Nonproduction-only AWS App Runner candidate. Source is the existing NestJS modular monolith.
# No runtime credential is baked into the image. The application must pass
# validateApiRuntimeEnvironment before opening ANY DB connection.
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/hustle
COPY . .
RUN npm ci
RUN npm run build --workspace=@hustle/api
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/hustle
COPY --from=builder --chown=node:node /srv/hustle /srv/hustle
USER node
ENV NODE_ENV=production PORT=8080
ENV EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=false
ENV HUSTLE_FINANCIAL_PROVIDERS_ENABLED=false
EXPOSE 8080
CMD ["node", "apps/api/dist/main.js"]
