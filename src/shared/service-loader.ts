/**
 * Service Loader for automatic service registration
 */

import { sliceContainer } from './container';
import { DebugLoggingService } from '../slices/debug-logging';
import { CalendarNavigationService } from '../slices/calendar-navigation';
import { SettingsService } from '../slices/settings-management';
import { FileOperationsService } from '../slices/file-operations';
import { RibbonService } from '../slices/ribbon-integration';
import { StreamManagementService } from '../slices/stream-management';
import { MobileIntegrationService } from '../slices/mobile-integration';
import { APIService } from '../slices/api';
import { CommandRegistrationService } from '../slices/command-registration';
import { ContextMenuService } from '../slices/context-menu';

export class ServiceLoader {
    /**
     * Register all services in the correct order
     */
    static registerAllServices(): void {
        // Register services in dependency order
        sliceContainer.register('debug-logging', new DebugLoggingService());
        sliceContainer.register('settings-management', new SettingsService());
        sliceContainer.register('api', new APIService());
        sliceContainer.register('stream-management', new StreamManagementService());
        sliceContainer.register('calendar-navigation', new CalendarNavigationService());
        sliceContainer.register('file-operations', new FileOperationsService());
        sliceContainer.register('ribbon-integration', new RibbonService());
        sliceContainer.register('mobile-integration', new MobileIntegrationService());
        sliceContainer.register('command-registration', new CommandRegistrationService());
        sliceContainer.register('context-menu', new ContextMenuService());
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
