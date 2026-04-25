FROM node:20-slim

# Set working directory
WORKDIR /app

# Install build dependencies just in case, but Debian usually has prebuilt binaries
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose port (default is 3000)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]