// Use proper ES module imports
import { HeimdallAPI } from "./heimdall-api.js";
import { logger } from "./logger.js";
import * as dotenv from 'dotenv';
// No fs or path imports needed

// Load environment variables
dotenv.config();

// Test contract addresses - starting with simpler ones more likely to decompile
const TEST_CONTRACTS = [

    // The Uniswap token contract
    {
        address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        name: "UNI"
    }
];

// Initialize the API with Ethereum mainnet RPC
const rpcUrl = "https://eth.llamarpc.com";
logger.info(`Using RPC endpoint: ${rpcUrl}`);
const api = new HeimdallAPI(rpcUrl);

// Function to test decompilation
async function testDecompile() {
    logger.info("=== STARTING DECOMPILATION TEST ===");

    // Test each contract in sequence
    for (const contract of TEST_CONTRACTS) {
        logger.info(`\n=== TESTING CONTRACT: ${contract.name} (${contract.address}) ===`);

        // First test getting basic contract stats (simpler operation)
        try {
            logger.info("Getting contract stats...");
            const stats = await api.getStats(contract.address);
            logger.info(`Contract stats: ${JSON.stringify(stats)}`);
            logger.info("Stats retrieval successful");
        } catch (error) {
            logger.error(`Failed to get stats for ${contract.name}`, error);
            // Continue to next contract
            continue;
        }

        // Now try the decompilation with a reasonably long timeout
        try {
            logger.info(`Testing decompilation for ${contract.name}`);
            const result = await api.decompile(contract.address, 60000); // 60 second timeout

            // Show a preview of the output (first 200 characters)
            const previewLength = 200;
            logger.info(`Decompilation output preview (first ${previewLength} chars):`);
            logger.info(result.substring(0, Math.min(previewLength, result.length)) + "...");

            // Just log completion - NO file operations
            logger.info(`Decompilation of ${contract.name} completed successfully - full output logged above`);
        } catch (error) {
            logger.error(`Decompilation of ${contract.name} failed`, error);
        }
    }

    logger.info("=== TEST COMPLETED ===");
}

// Run the test
testDecompile().catch(err => {
    logger.error("Uncaught error in test", err);
});