/**
 * Service Loader for automatic service registration
 */

import { sliceContainer } from './SliceContainer';
import { configurationService } from './ConfigurationService';
import { getAllServiceConfigs } from './service-config';

export class ServiceLoader {
    /**
     * Register all services using configuration-driven approach
     */
    static registerAllServices(): void {
        // Initialize configuration service first (foundational service)
        sliceContainer.register('configuration', configurationService);

        // Register all services from configuration
        const serviceConfigs = getAllServiceConfigs();
        for (const config of serviceConfigs) {
            const service = config.factory();
            sliceContainer.register(config.name, service);
        }
    }

    /**
     * Initialize all services
     */
    static async initializeAllServices(): Promise<void> {
        await sliceContainer.initializeAll();
    }

    /**
     * Cleanup all services
     */
    static cleanupAllServices(): void {
        sliceContainer.cleanupAll();
    }
}
