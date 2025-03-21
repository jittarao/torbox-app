# Use Node.js LTS as the base image
FROM node:23

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json yarn.lock* package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
CMD ["npm", "start"]
