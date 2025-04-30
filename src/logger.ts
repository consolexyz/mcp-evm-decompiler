import * as fs from 'fs';
import * as path from 'path';

class Logger {
    private logFilePath: string;

    constructor() {
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
        this.logFilePath = path.join(logDir, `mcp-${new Date().toISOString().split('T')[0]}.log`);

        // Initialize log file
        this.info('Logger initialized');
    }

    private writeLog(level: string, message: string) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;

        // Write to log file
        fs.appendFileSync(this.logFilePath, logEntry);

        // Also output to console
        console.log(`${level}: ${message}`);
    }

    info(message: string) {
        this.writeLog('INFO', message);
    }

    error(message: string, error?: any) {
        let errorMessage = message;
        if (error) {
            if (error instanceof Error) {
                errorMessage += `: ${error.message}\n${error.stack || ''}`;
            } else {
                errorMessage += `: ${JSON.stringify(error)}`;
            }
        }
        this.writeLog('ERROR', errorMessage);
    }

    warn(message: string) {
        this.writeLog('WARN', message);
    }

    debug(message: string) {
        this.writeLog('DEBUG', message);
    }
}

export const logger = new Logger();