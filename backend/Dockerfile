FROM node:20-alpine

# curl is used by the healthcheck and by Render cron jobs that hit the API
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY --chown=node:node package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY --chown=node:node src/ ./src/

# Copy blog content
COPY --chown=node:node content/ ./content/

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

# Run as non-root user (node user is built into node:alpine images)
USER node

# Start API (not worker — worker is a separate Railway service)
CMD ["node", "src/index.js"]
