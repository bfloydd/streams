/**
 * Service Registry for managing service instances and providing type-safe access
 *
 * This registry provides access to all slice services registered in the container.
 * For utility services that are singletons (not slice services), access them directly.
 */

import { sliceContainer } from './container';
import { DebugLoggingService } from '../slices/debug-logging';
import { StreamManagementService } from '../slices/stream-management';
import { APIService } from '../slices/api';
import { FileOperationsService } from '../slices/file-operations';
import { SettingsService } from '../slices/settings-management';
import { CalendarNavigationService } from '../slices/calendar-navigation';
import { RibbonService } from '../slices/ribbon-integration';
import { MobileIntegrationService } from '../slices/mobile-integration';
import { CommandRegistrationService } from '../slices/command-registration';
import { ContextMenuService } from '../slices/context-menu';

export class ServiceRegistry {
    private static instance: ServiceRegistry;

    private constructor() {}

    static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }

    // Type-safe service getters for slice services
    get debugLogging(): DebugLoggingService | undefined {
        return sliceContainer.get('debug-logging') as DebugLoggingService;
    }

    get streamManagement(): StreamManagementService | undefined {
        return sliceContainer.get('stream-management') as StreamManagementService;
    }

    get api(): APIService | undefined {
        return sliceContainer.get('api') as APIService;
    }

    get fileOperations(): FileOperationsService | undefined {
        return sliceContainer.get('file-operations') as FileOperationsService;
    }

    get settings(): SettingsService | undefined {
        return sliceContainer.get('settings-management') as SettingsService;
    }

    get calendarNavigation(): CalendarNavigationService | undefined {
        return sliceContainer.get('calendar-navigation') as CalendarNavigationService;
    }

    get ribbon(): RibbonService | undefined {
        return sliceContainer.get('ribbon-integration') as RibbonService;
    }

    get mobileIntegration(): MobileIntegrationService | undefined {
        return sliceContainer.get('mobile-integration') as MobileIntegrationService;
    }

    get commandRegistration(): CommandRegistrationService | undefined {
        return sliceContainer.get('command-registration') as CommandRegistrationService;
    }

    get contextMenu(): ContextMenuService | undefined {
        return sliceContainer.get('context-menu') as ContextMenuService;
    }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();
