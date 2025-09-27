/**
 * Memory Management System
 */

import { centralizedLogger } from './centralized-logger';

export interface MemoryStats {
    used: number;
    total: number;
    percentage: number;
    timestamp: number;
}

export class MemoryManager {
    private static instance: MemoryManager;
    private cleanupTasks: Array<() => void> = [];
    private isMonitoring = false;
    private monitoringInterval: number | null = null;
    private memoryThreshold = 0.8; // 80% memory usage threshold

    private constructor() {}

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager();
        }
        return MemoryManager.instance;
    }

    /**
     * Register a cleanup task
     */
    registerCleanupTask(task: () => void): () => void {
        this.cleanupTasks.push(task);
        
        // Return unregister function
        return () => {
            const index = this.cleanupTasks.indexOf(task);
            if (index > -1) {
                this.cleanupTasks.splice(index, 1);
            }
        };
    }

    /**
     * Get current memory usage (if available)
     */
    getMemoryStats(): MemoryStats | null {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            const memory = (performance as any).memory;
            const used = memory.usedJSHeapSize;
            const total = memory.totalJSHeapSize;
            const percentage = total > 0 ? used / total : 0;

            return {
                used,
                total,
                percentage,
                timestamp: Date.now()
            };
        }
        return null;
    }

    /**
     * Start memory monitoring
     */
    startMonitoring(intervalMs: number = 30000): void {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitoringInterval = window.setInterval(() => {
            this.checkMemoryUsage();
        }, intervalMs);
    }

    /**
     * Stop memory monitoring
     */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
    }

    /**
     * Check memory usage and trigger cleanup if needed
     */
    private checkMemoryUsage(): void {
        const stats = this.getMemoryStats();
        if (!stats) return;

        if (stats.percentage > this.memoryThreshold) {
            centralizedLogger.warn(`High memory usage detected: ${(stats.percentage * 100).toFixed(1)}%`);
            this.performCleanup();
        }
    }

    /**
     * Perform memory cleanup
     */
    performCleanup(): void {
        centralizedLogger.info('Performing memory cleanup...');
        
        let cleanedCount = 0;
        this.cleanupTasks.forEach(task => {
            try {
                task();
                cleanedCount++;
            } catch (error) {
                centralizedLogger.error('Error during cleanup task:', error);
            }
        });

        centralizedLogger.info(`Memory cleanup completed. ${cleanedCount} tasks executed.`);
    }

    /**
     * Force garbage collection (if available)
     */
    forceGarbageCollection(): void {
        if (typeof window !== 'undefined' && 'gc' in window) {
            (window as any).gc();
        }
    }

    /**
     * Set memory threshold
     */
    setMemoryThreshold(threshold: number): void {
        this.memoryThreshold = Math.max(0, Math.min(1, threshold));
    }

    /**
     * Get memory threshold
     */
    getMemoryThreshold(): number {
        return this.memoryThreshold;
    }

    /**
     * Get cleanup task count
     */
    getCleanupTaskCount(): number {
        return this.cleanupTasks.length;
    }

    /**
     * Clear all cleanup tasks
     */
    clearCleanupTasks(): void {
        this.cleanupTasks = [];
    }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();

// Utility functions
export function registerCleanupTask(task: () => void): () => void {
    return memoryManager.registerCleanupTask(task);
}

