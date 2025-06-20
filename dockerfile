# backend/Dockerfile

# Use an official Node.js runtime as a parent image
# Using Alpine version for a smaller image size
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "run", "dev"]
