import { Logger, LogLevel } from '../slices/debug-logging/Logger';

/**
 * Centralized logging service for the entire plugin
 * This eliminates duplicate logging implementations and provides a single source of truth
 */
class CentralizedLogger {
    private static instance: CentralizedLogger;
    private logger: Logger;

    private constructor() {
        this.logger = new Logger('Streams');
    }

    /**
     * Get the singleton instance of the centralized logger
     */
    static getInstance(): CentralizedLogger {
        if (!CentralizedLogger.instance) {
            CentralizedLogger.instance = new CentralizedLogger();
        }
        return CentralizedLogger.instance;
    }

    /**
     * Get the underlying logger instance
     */
    getLogger(): Logger {
        return this.logger;
    }

    /**
     * Enable logging with specified level
     */
    enable(level: LogLevel = LogLevel.INFO): void {
        this.logger.on(level);
    }

    /**
     * Disable logging
     */
    disable(): void {
        this.logger.off();
    }

    /**
     * Check if logging is enabled
     */
    isEnabled(): boolean {
        return this.logger.isEnabled();
    }

    /**
     * Mission-critical error logging
     */
    error(message: string, ...args: any[]): void {
        this.logger.error(message, ...args);
    }

    /**
     * Important warning logging
     */
    warn(message: string, ...args: any[]): void {
        this.logger.warn(message, ...args);
    }

    /**
     * Important info logging (startup, major state changes)
     */
    info(message: string, ...args: any[]): void {
        this.logger.info(message, ...args);
    }

    /**
     * Debug logging (only for troubleshooting)
     */
    debug(message: string, ...args: any[]): void {
        this.logger.debug(message, ...args);
    }
}

// Export singleton instance
export const centralizedLogger = CentralizedLogger.getInstance();
export { LogLevel } from '../slices/debug-logging/Logger';
