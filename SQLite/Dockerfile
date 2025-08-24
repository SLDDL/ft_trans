FROM node:20-alpine
WORKDIR /app

# Install build dependencies and SQLite
RUN apk add --no-cache python3 make g++ sqlite wget

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install
RUN npm ci --omit=dev

# Create data directory
RUN mkdir -p /data && chmod 755 /data

# Copy application code 
COPY server.js ./
COPY docker-entrypoint.sh ./

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Environment variables
ENV PORT=7000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/app.db

EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7000/healthz || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
