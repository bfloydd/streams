/**
 * Centralized Error Handling System
 */

import { eventBus, EVENTS } from './event-bus';

export interface ErrorContext {
    service: string;
    method: string;
    data?: any;
    timestamp: number;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorCount = 0;
    private maxErrors = 100;
    private errors: Array<{ error: Error; context: ErrorContext }> = [];

    private constructor() {}

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle an error with context
     */
    handleError(error: Error, context: ErrorContext): void {
        this.errorCount++;
        
        // Store error for debugging
        this.errors.push({ error, context });
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Emit error event
        eventBus.emit(EVENTS.ERROR_OCCURRED, {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context
        }, 'error-handler');

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error(`[${context.service}] Error in ${context.method}:`, error);
            console.error('Context:', context);
        }
    }

    /**
     * Wrap a function with error handling
     */
    wrapFunction<T extends (...args: any[]) => any>(
        fn: T,
        service: string,
        method: string
    ): T {
        return ((...args: any[]) => {
            try {
                const result = fn(...args);
                
                // Handle async functions
                if (result && typeof result.then === 'function') {
                    return result.catch((error: Error) => {
                        this.handleError(error, {
                            service,
                            method,
                            data: args,
                            timestamp: Date.now()
                        });
                        throw error;
                    });
                }
                
                return result;
            } catch (error) {
                this.handleError(error as Error, {
                    service,
                    method,
                    data: args,
                    timestamp: Date.now()
                });
                throw error;
            }
        }) as T;
    }

    /**
     * Wrap an async function with error handling
     */
    wrapAsyncFunction<T extends (...args: any[]) => Promise<any>>(
        fn: T,
        service: string,
        method: string
    ): T {
        return ((...args: any[]) => {
            return fn(...args).catch((error: Error) => {
                this.handleError(error, {
                    service,
                    method,
                    data: args,
                    timestamp: Date.now()
                });
                throw error;
            });
        }) as T;
    }

    /**
     * Get error statistics
     */
    getErrorStats(): { count: number; recent: Array<{ error: Error; context: ErrorContext }> } {
        return {
            count: this.errorCount,
            recent: this.errors.slice(-10) // Last 10 errors
        };
    }

    /**
     * Clear error history
     */
    clearErrors(): void {
        this.errors = [];
        this.errorCount = 0;
    }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility function for easy error handling
export function handleError(error: Error, service: string, method: string, data?: any): void {
    errorHandler.handleError(error, {
        service,
        method,
        data,
        timestamp: Date.now()
    });
}

// Utility function for wrapping methods
export function withErrorHandling<T extends (...args: any[]) => any>(
    fn: T,
    service: string,
    method: string
): T {
    return errorHandler.wrapFunction(fn, service, method);
}

// Utility function for wrapping async methods
export function withAsyncErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    service: string,
    method: string
): T {
    return errorHandler.wrapAsyncFunction(fn, service, method);
}
