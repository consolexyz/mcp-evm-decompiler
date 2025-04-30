# Use Node.js as base image
FROM node:18

# Install necessary tools
RUN apt-get update && apt-get install -y curl build-essential libssl-dev && \
    apt-get clean

# Install Rust and build dependencies
RUN apt-get update && \
    apt-get install -y curl build-essential libssl-dev git pkg-config && \
    apt-get clean

RUN curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustc --version

# Build Heimdall using bifrost installer
ENV PATH="/root/.cargo/bin:/root/.local/bin:${PATH}"
RUN curl -L http://get.heimdall.rs | bash && \
    /root/.cargo/bin/bifrost && \
    bifrost
    heimdall --version

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
