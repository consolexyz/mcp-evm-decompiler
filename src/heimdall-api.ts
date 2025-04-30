import { ethers } from 'ethers';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

export class HeimdallAPI {
    private provider: ethers.JsonRpcProvider;
    private tempDir: string;
    private outputDir: string;

    constructor(rpcUrl: string) {
        logger.info(`Initializing HeimdallAPI with RPC URL: ${rpcUrl}`);
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        // Use temp directory from environment variables or default
        this.tempDir = process.env.TEMP_DIR ?
            path.resolve(process.env.TEMP_DIR) :
            path.join(process.cwd(), 'temp');

        // Set up output directory for Heimdall results
        this.outputDir = path.join(process.cwd(), 'output', 'local');

        logger.info(`Using temporary directory: ${this.tempDir}`);
        if (!fs.existsSync(this.tempDir)) {
            logger.info('Creating temp directory...');
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        // Ensure output directory exists - create full path if needed
        const parentOutputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(parentOutputDir)) {
            logger.info('Creating parent output directory...');
            fs.mkdirSync(parentOutputDir, { recursive: true });
        }

        if (!fs.existsSync(this.outputDir)) {
            logger.info('Creating output/local directory...');
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        this.checkHeimdallInstallation();
    }

    private async checkHeimdallInstallation() {
        logger.info('Checking Heimdall installation...');
        try {
            const { stdout } = await execAsync('heimdall --version');
            logger.info(`Heimdall version: ${stdout.trim()}`);
        } catch (error) {
            logger.error('Heimdall installation check failed', error);
            throw new Error(
                'Heimdall is not installed. Please install it using:\n' +
                '1. Install Rust: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh\n' +
                '2. Install Heimdall: curl -L http://get.heimdall.rs | bash\n' +
                '3. Run: bifrost\n' +
                'Or use Docker: docker run -it jonbecker/heimdall'
            );
        }
    }

    private async getContractBytecode(address: string): Promise<string> {
        logger.info(`Fetching bytecode for contract: ${address}`);
        const bytecode = await this.provider.getCode(address);
        logger.info(`Bytecode length: ${bytecode.length} bytes`);
        return bytecode;
    }

    async decompile(address: string, timeoutMs: number = 30000): Promise<string> {
        logger.info(`Starting decompilation for contract: ${address} with timeout ${timeoutMs}ms`);

        // 1. Get the bytecode directly
        const bytecode = await this.getContractBytecode(address);

        // Check if bytecode exists
        if (bytecode === "0x") {
            logger.error('No bytecode found for contract');
            throw new Error("Contract not found or has no code");
        }

        // Define backup output path
        const backupOutputPath = path.join(this.tempDir, `decompiled_${address}_${Date.now()}.sol`);

        // Define expected output paths
        const decompSolPath = path.join(this.outputDir, 'decompiled.sol');
        const abiJsonPath = path.join(this.outputDir, 'abi.json');

        // Clean up any previous output files before starting
        try {
            if (fs.existsSync(decompSolPath)) {
                fs.unlinkSync(decompSolPath);
                logger.info(`Removed previous decompiled.sol file`);
            }
            if (fs.existsSync(abiJsonPath)) {
                fs.unlinkSync(abiJsonPath);
                logger.info(`Removed previous abi.json file`);
            }
        } catch (error) {
            logger.warn(`Failed to clean up previous output files: ${(error as Error).message}`);
        }

        // Ensure output directories exist before starting decompilation
        const parentOutputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(parentOutputDir)) {
            logger.info('Creating parent output directory before decompilation...');
            fs.mkdirSync(parentOutputDir, { recursive: true });
        }

        if (!fs.existsSync(this.outputDir)) {
            logger.info('Creating output/local directory before decompilation...');
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // 2. Create a temporary file for the bytecode
        const tempFileName = `contract_${address}_${Date.now()}.bin`;
        const tempFilePath = path.join(this.tempDir, tempFileName);

        // Write bytecode to temp file
        fs.writeFileSync(tempFilePath, bytecode);
        logger.info(`Saved bytecode to temporary file: ${tempFilePath}`);

        try {
            // 3. Run the Heimdall CLI command directly and log the output
            logger.info('Running Heimdall decompilation...');
            const { stdout, stderr } = await execAsync(
                `heimdall decompile ${tempFilePath} --include-sol`,
                { timeout: timeoutMs }
            );

            // Log the full compiler output for debugging
            logger.info('=== HEIMDALL COMPILATION OUTPUT START ===');
            logger.info(stdout || '(No stdout output)');
            if (stderr) {
                logger.info('=== HEIMDALL STDERR OUTPUT ===');
                logger.info(stderr);
            }
            logger.info('=== HEIMDALL COMPILATION OUTPUT END ===');

            // PRIORITY 1: Check for output file in the expected location first
            if (fs.existsSync(decompSolPath)) {
                logger.info(`Found decompiled source code in file: ${decompSolPath}`);
                try {
                    const fileContent = fs.readFileSync(decompSolPath, 'utf8');

                    // Check if the file content is meaningful Solidity code
                    if (fileContent && fileContent.trim().length > 0) {
                        logger.info(`Successfully read decompiled source from file (${fileContent.length} bytes)`);

                        // Save a backup copy
                        try {
                            fs.writeFileSync(backupOutputPath, fileContent);
                            logger.info(`Saved backup of file content to ${backupOutputPath}`);
                        } catch (backupError) {
                            logger.warn(`Couldn't save file backup: ${(backupError as Error).message}`);
                        }

                        return fileContent;
                    } else {
                        logger.warn('Decompiled.sol file exists but appears to be empty');
                    }
                } catch (error) {
                    const readErr = error as Error;
                    logger.error(`Failed to read decompiled.sol: ${readErr.message}`);
                }
            } else {
                logger.warn(`decompiled.sol file not found at ${decompSolPath}`);
            }

            // PRIORITY 2: Check stdout for Solidity code if the file didn't exist or was empty
            if (stdout && stdout.trim().length > 0 && (
                stdout.includes('pragma solidity') ||
                stdout.includes('SPDX-License-Identifier')
            )) {
                logger.info('Found valid Solidity code in command stdout');

                // Save a copy for future reference
                try {
                    fs.writeFileSync(backupOutputPath, stdout);
                    logger.info(`Saved backup of stdout to ${backupOutputPath}`);

                    // Also save to expected output location for consistency
                    fs.writeFileSync(decompSolPath, stdout);
                    logger.info(`Saved stdout to ${decompSolPath} for future reference`);
                } catch (error) {
                    const writeErr = error as Error;
                    logger.warn(`Couldn't save stdout: ${writeErr.message}`);
                }

                return stdout;
            }

            // PRIORITY 3: Check for ABI file
            if (fs.existsSync(abiJsonPath)) {
                logger.info(`Found ABI file: ${abiJsonPath}`);
                try {
                    const abiContent = fs.readFileSync(abiJsonPath, 'utf8');
                    logger.info(`Successfully read ABI (${abiContent.length} bytes)`);

                    // Try to generate a basic Solidity interface from the ABI
                    try {
                        const abiObj = JSON.parse(abiContent);
                        const interfaceCode = this.generateInterfaceFromABI(abiObj, address);

                        if (interfaceCode) {
                            logger.info(`Generated Solidity interface from ABI`);

                            // Save the interface to the expected output location
                            fs.writeFileSync(decompSolPath, interfaceCode);
                            logger.info(`Saved generated interface to ${decompSolPath}`);

                            return interfaceCode;
                        }
                    } catch (parseError) {
                        logger.error(`Failed to parse ABI or generate interface: ${(parseError as Error).message}`);
                    }
                } catch (error) {
                    const abiErr = error as Error;
                    logger.error(`Failed to read ABI file: ${abiErr.message}`);
                }
            }

            // FALLBACK: Return stdout as fallback, even if it's empty or doesn't look like Solidity
            if (stdout && stdout.trim().length > 0) {
                logger.info('Returning command output as fallback');
                return stdout;
            }

            logger.warn('No decompiled source code or ABI was found');
            return `// Decompilation could not produce source code for contract: ${address}\n// Please try again or check contract on Etherscan: https://etherscan.io/address/${address}#code`;

        } catch (error) {
            const err = error as Error;
            logger.error(`Decompilation failed: ${err.message}`);

            // If we have stderr from the command, log that too
            if ((error as any).stderr) {
                logger.error(`Compiler stderr: ${(error as any).stderr}`);
            }

            // Check if files were still created despite the error
            if (fs.existsSync(decompSolPath)) {
                logger.info(`Found decompiled source code in file despite error: ${decompSolPath}`);
                try {
                    const fileContent = fs.readFileSync(decompSolPath, 'utf8');
                    if (fileContent && fileContent.trim().length > 0) {
                        logger.info(`Recovered decompiled source from file (${fileContent.length} bytes)`);
                        return fileContent;
                    }
                } catch (readError) {
                    logger.error(`Failed to read decompiled source file: ${readError}`);
                }
            }

            throw new Error(`Failed to decompile contract: ${err.message}`);
        } finally {
            // Clean up the temp file
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    logger.info(`Removed temporary file: ${tempFilePath}`);
                }
            } catch (error) {
                logger.error('Failed to remove temporary file', error);
            }
        }
    }

    async getStorage(address: string): Promise<string> {
        logger.info(`Fetching storage for contract: ${address}`);
        try {
            const { stdout } = await execAsync(`heimdall storage ${address}`);
            logger.info('Storage analysis completed successfully');
            return stdout;
        } catch (err: unknown) {
            const error = err as Error;
            logger.error('Storage analysis failed', error);
            throw new Error(`Storage analysis failed: ${error.message}`);
        }
    }

    async getStats(address: string): Promise<{
        size: number;
    }> {
        logger.info(`Getting stats for contract: ${address}`);
        try {
            const bytecode = await this.getContractBytecode(address);

            if (bytecode === "0x") {
                logger.error('No bytecode found for contract');
                throw new Error("Contract not found or has no code");
            }

            const stats = {
                size: (bytecode.length - 2) / 2
            };
            logger.info(`Stats for contract ${address}: ${JSON.stringify(stats)}`);
            return stats;
        } catch (err: unknown) {
            const error = err as Error;
            logger.error('Stats analysis failed', error);
            throw new Error(`Stats analysis failed: ${error.message}`);
        }
    }

    /**
     * Generates a basic Solidity interface from an ABI object
     * @param abi The contract ABI as a JSON object
     * @param address The contract address for documentation
     * @returns A Solidity interface based on the ABI
     */
    private generateInterfaceFromABI(abi: any[], address: string): string {
        logger.info(`Generating Solidity interface from ABI for contract: ${address}`);
        try {
            if (!Array.isArray(abi) || abi.length === 0) {
                logger.warn('ABI is empty or not an array');
                return '';
            }

            // Find a name for the contract from any of the function inputs or outputs
            let contractName = 'DecompiledContract';
            const abiItem = abi.find((item: any) =>
                item.name &&
                (item.type === 'function' || item.type === 'event' || item.type === 'constructor')
            );
            if (abiItem?.name) {
                contractName = `${abiItem.name.charAt(0).toUpperCase() + abiItem.name.slice(1)}Contract`;
            }

            // Generate interface
            let solInterface = `// SPDX-License-Identifier: MIT
// Generated interface for contract: ${address}
// Generated at: ${new Date().toISOString()}
pragma solidity ^0.8.0;

/**
 * @title ${contractName}
 * @dev Generated interface from ABI for contract at ${address}
 * This is a partial representation based on the contract's ABI.
 * For a full decompilation, try using a tool like Heimdall directly.
 */
interface ${contractName} {`;

            // Add events
            const events = abi.filter((item: any) => item.type === 'event');
            if (events.length > 0) {
                solInterface += '\n    // Events';
                for (const event of events) {
                    const params = (event.inputs || []).map((input: any) => {
                        const indexed = input.indexed ? ' indexed' : '';
                        return `${input.type}${indexed} ${input.name || ''}`;
                    }).join(', ');
                    solInterface += `\n    event ${event.name}(${params});`;
                }
            }

            // Add functions
            const functions = abi.filter((item: any) => item.type === 'function');
            if (functions.length > 0) {
                solInterface += '\n\n    // Functions';
                for (const func of functions) {
                    const inputs = (func.inputs || []).map((input: any) =>
                        `${input.type} ${input.name || ''}`
                    ).join(', ');

                    let outputs = '';
                    if (func.outputs && func.outputs.length > 0) {
                        outputs = ' returns (' + func.outputs.map((output: any) =>
                            `${output.type} ${output.name || ''}`
                        ).join(', ') + ')';
                    }

                    const mutability = func.stateMutability ?
                        (func.stateMutability !== 'nonpayable' ? ` ${func.stateMutability}` : '') : '';

                    solInterface += `\n    function ${func.name}(${inputs})${mutability} external${outputs};`;
                }
            }

            // Close the interface
            solInterface += '\n}\n';

            logger.info(`Generated Solidity interface with ${events.length} events and ${functions.length} functions`);
            return solInterface;
        } catch (error) {
            logger.error(`Failed to generate interface: ${(error as Error).message}`);
            return '';
        }
    }
}