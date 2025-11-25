FROM node:18-alpine

# Install build dependencies for native modules and pg_dump
RUN apk add --no-cache python3 make g++ postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src
COPY public ./public
COPY database ./database

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create necessary directories
RUN mkdir -p logs backups

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/server.js"]

