FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev deps for tsx and vite)
COPY package*.json ./
RUN npm ci && \
    npm cache clean --force

# Remove unnecessary files to reduce image size
RUN find . -name "*.test.js" -delete && \
    find . -name "*.spec.js" -delete && \
    rm -rf /tmp/* /var/tmp/* /var/log/* && \
    rm -rf /root/.cache

# Copy source code (will be overridden by docker-compose volume in dev)
COPY . .

# Expose port
EXPOSE 3000

# Start the development server with tsx
CMD ["npm", "run", "dev"]
