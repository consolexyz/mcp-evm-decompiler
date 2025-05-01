import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HeimdallAPI } from "./heimdall-api.js";
import { logger } from "./logger.js";
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Initialize Heimdall API with Monad Testnet RPC
const RPC_ENDPOINT = "https://testnet-rpc.monad.xyz";
logger.info(`Initializing HeimdallAPI Monad testnet endpoint: ${RPC_ENDPOINT}`);
const heimdall = new HeimdallAPI(RPC_ENDPOINT);

// Create an MCP server for contract analysis
const server = new McpServer({
    name: "ContractDecompiler",
    version: "1.0.0"
});
logger.info("MCP Server created");

server.tool(
    "decompileContract",
    {
        address: z.string(),
    },
    async ({ address }) => {
        logger.info(`Tool called: decompileContract for ${address}`);
        try {
            // Get basic stats first (faster operation)
            const stats = await heimdall.getStats(address);
            logger.info(`Retrieved stats for contract ${address}: ${JSON.stringify(stats)}`);

            // Run the decompilation with a reasonable timeout
            const decompileResult = await heimdall.decompile(address, 60000);
            logger.info(`Decompilation for ${address} completed, output length: ${decompileResult.length}`);

            // Check for ABI file
            let abiInfo = '';
            const abiPath = path.join(process.cwd(), 'output', 'local', 'abi.json');
            if (fs.existsSync(abiPath)) {
                try {
                    const abiContent = fs.readFileSync(abiPath, 'utf8');
                    const abiJson = JSON.parse(abiContent);
                    const functionCount = abiJson.filter((item: any) => item.type === 'function').length;
                    const eventCount = abiJson.filter((item: any) => item.type === 'event').length;

                    abiInfo = `\n## Contract ABI Information
- Functions: ${functionCount}
- Events: ${eventCount}
                    
The full ABI is available in the output/local/abi.json file.`;
                } catch (error) {
                    logger.error(`Error reading ABI file: ${(error as Error).message}`);
                    abiInfo = '\nABI file was generated but could not be parsed.';
                }
            }

            // Format and return the output
            const analysis = `# Decompiled Contract: ${address} (Monad Testent)

## Contract Statistics
- Size: ${stats.size} bytes
- Status: Decompilation completed
${abiInfo}

## Decompiled Output
\`\`\`solidity
${decompileResult || "No decompiled source code was produced"}
\`\`\`

The decompiled source code has been saved to: output/local/decompiled.sol`;

            logger.info("decompileContract: Completed successfully");
            return {
                content: [{ type: "text", text: analysis }]
            };
        } catch (err: unknown) {
            const error = err as Error;
            logger.error("Error in decompileContract", error);

            // Try to return partial information if only decompilation failed but stats were retrieved
            try {
                const stats = await heimdall.getStats(address);

                return {
                    content: [{
                        type: "text",
                        text: `# Contract Analysis: ${address} (Monad Testnet)

## Contract Statistics
- Size: ${stats.size} bytes

## Decompilation Error
Could not decompile this contract: ${error.message}

This could be due to:
- Contract complexity
- Decompilation timeout
- Invalid or unusual bytecode

You can check if this contract has verified source code on Monad Explorer:
https://testnet.monadexplorer.com/address/${address}#code`
                    }],
                    isError: true
                };
            } catch (statsError) {
                // If everything failed, return a generic error
                return {
                    content: [{ type: "text", text: `Error decompiling contract: ${error.message}` }],
                    isError: true
                };
            }
        }
    }
);

// Start the server
const transport = new StdioServerTransport();
logger.info("Connecting to MCP transport...");
await server.connect(transport).catch(err => {
    logger.error("Failed to connect to transport", err);
    process.exit(1);
});
logger.info("MCP Server started successfully!");