import { Logger, LogLevel } from '../slices/debug-logging/Logger';

// Centralized logging for the plugin
class CentralizedLogger {
    private static instance: CentralizedLogger;
    private logger: Logger;

    private constructor() {
        this.logger = new Logger('Streams');
    }

    static getInstance(): CentralizedLogger {
        if (!CentralizedLogger.instance) {
            CentralizedLogger.instance = new CentralizedLogger();
        }
        return CentralizedLogger.instance;
    }

    getLogger(): Logger {
        return this.logger;
    }

    enable(level: LogLevel = LogLevel.INFO): void {
        this.logger.on(level);
    }

    disable(): void {
        this.logger.off();
    }

    isEnabled(): boolean {
        return this.logger.isEnabled();
    }

    error(message: string, ...args: any[]): void {
        this.logger.error(message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.logger.warn(message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.logger.info(message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.logger.debug(message, ...args);
    }
}

export const centralizedLogger = CentralizedLogger.getInstance();
export { LogLevel } from '../slices/debug-logging/Logger';
