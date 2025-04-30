# Heimdall MCP Server

A Model Context Protocol (MCP) server that uses Heimdall for smart contract analysis and decompilation.

## Features

- Smart contract decompilation
- Storage analysis
- Control flow graph generation
- Abstract syntax tree analysis
- Contract statistics

## Installation

### Option 1: Using Docker (Recommended)

```
# Build the Docker image
docker build -t heimdall-mcp .

# Run the container
docker run -p 3000:3000 heimdall-mcp
```

### Option 2: Manual Installation

1. Install Rust:
```bash
curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install Heimdall:
```bash
curl -L http://get.heimdall.rs | bash
bifrost
```

3. Install Node.js dependencies:
```bash
npm install
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

## Usage

The MCP server provides several tools for contract analysis:

### 1. Explain Contract
```typescript
// Basic analysis
explainContract({ address: "0x..." })

// Detailed analysis
explainContract({ address: "0x...", analysisType: "detailed" })

// Security analysis
explainContract({ address: "0x...", analysisType: "security" })
```

### 2. Decompile and Analyze
```typescript
// Get decompiled source
decompileAndAnalyze({ address: "0x...", includeSource: true })

// Get AST analysis
decompileAndAnalyze({ address: "0x...", format: "ast" })

// Get control flow graph
decompileAndAnalyze({ address: "0x...", format: "cfg" })
```

### 3. Get Contract Statistics
```typescript
getContractStats({ address: "0x..." })
```

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 