
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

    registerCleanupTask(task: () => void): () => void {
        this.cleanupTasks.push(task);
        
        return () => {
            const index = this.cleanupTasks.indexOf(task);
            if (index > -1) {
                this.cleanupTasks.splice(index, 1);
            }
        };
    }

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

    startMonitoring(intervalMs: number = 30000): void {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitoringInterval = window.setInterval(() => {
            this.checkMemoryUsage();
        }, intervalMs);
    }

    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
    }

    private checkMemoryUsage(): void {
        const stats = this.getMemoryStats();
        if (!stats) return;

        if (stats.percentage > this.memoryThreshold) {
            centralizedLogger.warn(`High memory usage detected: ${(stats.percentage * 100).toFixed(1)}%`);
            this.performCleanup();
        }
    }

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

    forceGarbageCollection(): void {
        if (typeof window !== 'undefined' && 'gc' in window) {
            (window as any).gc();
        }
    }

    setMemoryThreshold(threshold: number): void {
        this.memoryThreshold = Math.max(0, Math.min(1, threshold));
    }

    getMemoryThreshold(): number {
        return this.memoryThreshold;
    }

    getCleanupTaskCount(): number {
        return this.cleanupTasks.length;
    }

    clearCleanupTasks(): void {
        this.cleanupTasks = [];
    }
}

export const memoryManager = MemoryManager.getInstance();

export function registerCleanupTask(task: () => void): () => void {
    return memoryManager.registerCleanupTask(task);
}

