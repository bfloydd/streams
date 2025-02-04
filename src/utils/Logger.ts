// Add global type declarations
declare global {
    interface Window {
        log: {
            on: (level?: LogLevel | keyof typeof LogLevel | number) => void;
            off: () => void;
        }
    }
}

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export class Logger {
    private enabled: boolean = false;
    private level: LogLevel = LogLevel.INFO;
    private static instance: Logger;

    constructor() {
        if (!Logger.instance) {
            Logger.instance = this;
            // @ts-ignore
            window.log = {
                on: this.on.bind(this),
                off: this.off.bind(this)
            };
        }
        return Logger.instance;
    }

    on(level: LogLevel | keyof typeof LogLevel | number = LogLevel.INFO) {
        this.enabled = true;
        if (typeof level === 'string') {
            this.level = LogLevel[level] as number;
        } else {
            this.level = level;
        }
        this.info(`Logging enabled at level: ${LogLevel[this.level]}`);
    }

    off() {
        this.enabled = false;
        this.level = LogLevel.NONE;
        this.info('Logging disabled');
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

    setLogging(level: string | boolean) {
        this.debug('setLogging called with:', level);
        const parsedLevel = Logger.parseLogLevel(level);
        this.debug('parsed level:', parsedLevel);
        
        if (typeof parsedLevel === 'boolean') {
            this.enabled = parsedLevel;
            this.level = LogLevel.INFO;
            this.debug(`Logging ${parsedLevel ? 'enabled' : 'disabled'} (level: ${LogLevel[this.level]})`);
            this.debug('Current state:', { enabled: this.enabled, level: this.level });
        } else {
            this.enabled = true;
            this.level = parsedLevel;
            this.debug(`Logging level set to ${LogLevel[this.level]}`);
            this.debug('Current state:', { enabled: this.enabled, level: this.level });
        }
    }

    /**********************************************************
     * Primary debug levels
     *********************************************************/

    debug(message?: any, ...optionalParams: any[]) {
        if (!this.enabled || this.level > LogLevel.DEBUG) {
            return;
        }
        console.debug(message, ...optionalParams);
    }

    info(message?: any, ...optionalParams: any[]) {
        if (!this.enabled || this.level > LogLevel.INFO) {
            return;
        }
        console.log(message, ...optionalParams);
    }

    warn(message?: any, ...optionalParams: any[]) {
        if (!this.enabled || this.level > LogLevel.WARN) {
            return;
        }
        console.warn(message, ...optionalParams);
    }

    error(message?: any, ...optionalParams: any[]) {
        if (!this.enabled || this.level > LogLevel.ERROR) {
            return;
        }
        console.error(message, ...optionalParams);
    }

    /**********************************************************
     * Extras
     *********************************************************/

    trace(message?: any, ...optionalParams: any[]) {
        if (this.enabled) {
            console.trace(message, ...optionalParams);
        }
    }

    group(label?: string) {
        if (this.enabled) {
            console.group(label);
        }
    }

    groupEnd() {
        if (this.enabled) {
            console.groupEnd();
        }
    }

    table(tabularData: any, properties?: string[]) {
        if (this.enabled) {
            console.table(tabularData, properties);
        }
    }

    time(label: string) {
        if (this.enabled) {
            console.time(label);
        }
    }

    timeEnd(label: string) {
        if (this.enabled) {
            console.timeEnd(label);
        }
    }
}