FROM node:18-alpine

# Install netcat for health checks and waiting for services
RUN apk add --no-cache netcat-openbsd

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Create a non-privileged user that the app will run under.
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy the entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nodejs

EXPOSE 3000 3001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start:full"]