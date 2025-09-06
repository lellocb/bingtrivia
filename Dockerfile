# Stage 1: Build the application
FROM node:18-alpine AS builder

# --- ADDED LINE ---
# Update the package repository and upgrade all packages to patch known vulnerabilities
RUN apk update && apk upgrade

WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Create the final, smaller image for production
FROM node:18-alpine

# --- ADDED LINE ---
# Also update the final image to ensure it's secure
RUN apk update && apk upgrade

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to start the application
CMD ["npm", "start"]