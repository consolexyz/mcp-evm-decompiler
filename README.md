# ABOUT THIS  MCP Server

A Model Context Protocol (MCP) server that uses Heimdall for smart contract analysis and decompilation.

## Features

- Smart contract decompilation
- Storage analysis


```

###  Manual Installation

1. Install Rust:
```bash
curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install Heimdall:
```bash
curl -L http://get.heimdall.rs | bash
bifrost
```

3. Clone the repository:
```bash
git clone https://github.com/consolexyz/mcp-evm-decompiler.git
cd mcp-evm-decompiler
```

4. Install Node.js dependencies:
```bash
npm install
```

5. Build the project:
```bash
npm run build
```


```

## Claude / VS Code Integration


```json
"evm-decompiler": {
    "type": "stdio",
    "command": "node",
    "args": [
        "/path/to/repo/dist/index.js"
    ]
}
```

Replace `/path/to/repo` with the actual path to where you've cloned this repository. This configuration allows Claude to communicate with the analyzer MCP server, 


### 2. Decompile and Analyze
```typescript
// Get decompiled source
decompileContract({ address: "0x...", includeSource: true })


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