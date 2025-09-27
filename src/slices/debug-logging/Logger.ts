export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    NONE = 4
}

// Usage: app.plugins.plugins.streams.log.on() or .off()
export class Logger {
    private enabled: boolean = false;
    private level: LogLevel = LogLevel.INFO;
    private prefix: string;

    constructor(prefix?: string) {
        this.prefix = prefix ? `[${prefix}] ` : '';
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    on(level: LogLevel | keyof typeof LogLevel | number = LogLevel.INFO): void {
        this.enabled = true;
        if (typeof level === 'string') {
            this.level = LogLevel[level] as number;
        } else {
            this.level = level;
        }
        if (this.level !== LogLevel.NONE) {
            this.info(`Logging enabled at level: ${LogLevel[this.level]}`);
        }
    }

    off(): void {
        this.enabled = false;
        this.level = LogLevel.NONE;
    }

    static parseLogLevel(level: string | boolean): LogLevel | boolean {
        if (typeof level === 'boolean') {
            return level;
        }

        const normalizedLevel = level.toUpperCase();
        switch (normalizedLevel) {
            case 'DEBUG': return LogLevel.DEBUG;
            case 'INFO': return LogLevel.INFO;
            case 'WARN': return LogLevel.WARN;
            case 'ERROR': return LogLevel.ERROR;
            case 'NONE': return LogLevel.NONE;
            default: return LogLevel.INFO;
        }
    }

    setLogging(level: string | boolean): void {
        const parsedLevel = Logger.parseLogLevel(level);
        
        if (typeof parsedLevel === 'boolean') {
            this.enabled = parsedLevel;
            this.level = LogLevel.INFO;
        } else {
            this.enabled = true;
            this.level = parsedLevel;
        }
    }


    debug(message?: any, ...optionalParams: any[]): void {
        if (!this.enabled || this.level > LogLevel.DEBUG) {
            return;
        }
        console.debug(this.prefix + message, ...optionalParams);
    }

    info(message?: any, ...optionalParams: any[]): void {
        if (!this.enabled || this.level > LogLevel.INFO) {
            return;
        }
        console.log(this.prefix + message, ...optionalParams);
    }

    warn(message?: any, ...optionalParams: any[]): void {
        if (!this.enabled || this.level > LogLevel.WARN) {
            return;
        }
        console.warn(this.prefix + message, ...optionalParams);
    }

    error(message?: any, ...optionalParams: any[]): void {
        if (!this.enabled || this.level > LogLevel.ERROR) {
            return;
        }
        console.error(this.prefix + message, ...optionalParams);
    }


    trace(message?: any, ...optionalParams: any[]): void {
        if (this.enabled) {
            console.trace(this.prefix + message, ...optionalParams);
        }
    }

    group(label?: string): void {
        if (this.enabled) {
            console.group(this.prefix + (label || ''));
        }
    }

    groupEnd(): void {
        if (this.enabled) {
            console.groupEnd();
        }
    }

    table(tabularData: any, properties?: string[]): void {
        if (this.enabled) {
            console.table(tabularData, properties);
        }
    }

    time(label: string): void {
        if (this.enabled) {
            console.time(this.prefix + label);
        }
    }

    timeEnd(label: string): void {
        if (this.enabled) {
            console.timeEnd(this.prefix + label);
        }
    }
}
