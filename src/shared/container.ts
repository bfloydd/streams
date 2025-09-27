import { Plugin } from 'obsidian';
import { SliceService, PluginAwareService } from './interfaces';

/**
 * Simple dependency injection container for managing slice services
 */
export class SliceContainer {
    private services = new Map<string, SliceService>();
    private plugin: Plugin | null = null;

    /**
     * Register a service in the container
     */
    register<T extends SliceService>(name: string, service: T): T {
        this.services.set(name, service);
        
        // If service is plugin-aware, set the plugin
        if (this.plugin && 'setPlugin' in service) {
            (service as unknown as PluginAwareService).setPlugin(this.plugin);
        }
        
        return service;
    }

    /**
     * Get a service from the container
     */
    get<T extends SliceService>(name: string): T | undefined {
        return this.services.get(name) as T | undefined;
    }

    /**
     * Set the plugin instance for all plugin-aware services
     */
    setPlugin(plugin: Plugin): void {
        this.plugin = plugin;
        
        // Update all existing plugin-aware services
        for (const service of this.services.values()) {
            if ('setPlugin' in service) {
                (service as unknown as PluginAwareService).setPlugin(plugin);
            }
        }
    }

    /**
     * Initialize all services
     */
    async initializeAll(): Promise<void> {
        const initPromises = Array.from(this.services.values()).map(service => 
            service.initialize().catch(error => {
                console.error(`Failed to initialize service ${service.constructor.name}:`, error);
            })
        );
        
        await Promise.all(initPromises);
    }

    /**
     * Cleanup all services
     */
    cleanupAll(): void {
        for (const service of this.services.values()) {
            try {
                service.cleanup();
            } catch (error) {
                console.error(`Failed to cleanup service ${service.constructor.name}:`, error);
            }
        }
    }

}

// Global container instance
export const sliceContainer = new SliceContainer();
