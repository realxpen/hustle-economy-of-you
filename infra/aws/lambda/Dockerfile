# Hustle disposable API staging — NestJS on Lambda via AWS Lambda Web Adapter.
# The adapter forwards Function URL HTTP events to the existing NestJS server.
# This image NEVER contains database URLs, tokens, .env files or credentials.
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/hustle
COPY . .
RUN npm ci --include=dev
RUN npm run build --workspace=@hustle/api
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter
WORKDIR /srv/hustle
COPY --from=builder --chown=node:node /srv/hustle /srv/hustle
USER node
ENV NODE_ENV=production PORT=8080 AWS_LWA_PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/api/v1/health \
    EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=false \
    HUSTLE_FINANCIAL_PROVIDERS_ENABLED=false
EXPOSE 8080
CMD ["node", "apps/api/dist/main.js"]
