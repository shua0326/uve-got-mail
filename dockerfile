# Development Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files first to leverage Docker caching
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies)
RUN pnpm install

# Copy source code
COPY . .

RUN npm install -g nodemon

# Expose port
EXPOSE 8888

# Use nodemon to watch for changes and restart the server
CMD ["nodemon", "--watch", "src", "--ext", "ts", "--exec", "ts-node", "src/server.ts"]