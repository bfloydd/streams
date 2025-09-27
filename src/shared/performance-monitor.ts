/**
 * Performance Monitoring System
 */

export interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: any;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: PerformanceMetric[] = [];
    private maxMetrics = 1000;
    private isEnabled = true;

    private constructor() {}

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Start timing a performance metric
     */
    startTiming(name: string): () => void {
        if (!this.isEnabled) return () => {};

        const startTime = performance.now();
        
        return () => {
            const duration = performance.now() - startTime;
            this.recordMetric(name, duration);
        };
    }

    /**
     * Record a performance metric
     */
    recordMetric(name: string, duration: number, metadata?: any): void {
        if (!this.isEnabled) return;

        this.metrics.push({
            name,
            duration,
            timestamp: Date.now(),
            metadata
        });

        // Keep only the most recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }
    }

    /**
     * Measure the execution time of a function
     */
    measure<T extends (...args: any[]) => any>(
        fn: T,
        name: string,
        metadata?: any
    ): T {
        return ((...args: any[]) => {
            const endTiming = this.startTiming(name);
            try {
                const result = fn(...args);
                
                // Handle async functions
                if (result && typeof result.then === 'function') {
                    return result.finally(() => {
                        endTiming();
                    });
                }
                
                endTiming();
                return result;
            } catch (error) {
                endTiming();
                throw error;
            }
        }) as T;
    }

    /**
     * Measure the execution time of an async function
     */
    measureAsync<T extends (...args: any[]) => Promise<any>>(
        fn: T,
        name: string,
        metadata?: any
    ): T {
        return ((...args: any[]) => {
            const endTiming = this.startTiming(name);
            return fn(...args).finally(() => {
                endTiming();
            });
        }) as T;
    }

    /**
     * Get performance statistics
     */
    getStats(name?: string): {
        total: number;
        average: number;
        min: number;
        max: number;
        recent: PerformanceMetric[];
    } {
        const filteredMetrics = name 
            ? this.metrics.filter(m => m.name === name)
            : this.metrics;

        if (filteredMetrics.length === 0) {
            return {
                total: 0,
                average: 0,
                min: 0,
                max: 0,
                recent: []
            };
        }

        const durations = filteredMetrics.map(m => m.duration);
        const total = durations.reduce((sum, duration) => sum + duration, 0);
        const average = total / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);

        return {
            total,
            average,
            min,
            max,
            recent: filteredMetrics.slice(-10)
        };
    }

    /**
     * Get all metrics
     */
    getAllMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics = [];
    }

    /**
     * Enable or disable performance monitoring
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Check if monitoring is enabled
     */
    isMonitoringEnabled(): boolean {
        return this.isEnabled;
    }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Utility functions
export function measurePerformance<T extends (...args: any[]) => any>(
    fn: T,
    name: string,
    metadata?: any
): T {
    return performanceMonitor.measure(fn, name, metadata);
}

export function measureAsyncPerformance<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name: string,
    metadata?: any
): T {
    return performanceMonitor.measureAsync(fn, name, metadata);
}

