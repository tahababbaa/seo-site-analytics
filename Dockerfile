FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (like better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose port (default is 3000)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]