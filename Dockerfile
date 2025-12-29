# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

# Build-time argument for API URL (can be overridden during build)
ARG NEXT_PUBLIC_API_URL=http://localhost:8080

WORKDIR /app/frontend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy frontend package files
COPY smserver-web/package.json smserver-web/pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY smserver-web/ ./

# Build frontend with standalone output
# Pass API URL to Next.js build (for client-side code)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

# Stage 2: Build backend
FROM golang:1.25-alpine AS backend-builder

WORKDIR /app/backend

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Copy go mod files
COPY backend/go.mod backend/go.sum ./

# Download dependencies
RUN go mod download

# Copy backend source
COPY backend/ ./

# Build backend binary
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o smserver .

# Stage 3: Final runtime image
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 1001 -S appuser && \
    adduser -S -u 1001 -G appuser appuser

# Copy backend binary
COPY --from=backend-builder /app/backend/smserver /app/backend/smserver
COPY --from=backend-builder /app/backend/config.sample.yaml /app/backend/config.sample.yaml

# Copy frontend build (standalone mode)
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public

# Copy startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create config directory
RUN mkdir -p /app/backend/config && \
    chown -R appuser:appuser /app

USER appuser

# Expose ports
EXPOSE 8080 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Set environment variables
ENV NEXT_PUBLIC_API_URL=http://localhost:8080 \
    NODE_ENV=production

ENTRYPOINT ["/app/docker-entrypoint.sh"]
