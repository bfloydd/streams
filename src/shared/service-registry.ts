/**
 * Service Registry for managing service instances and providing type-safe access
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

export class ServiceRegistry {
    private static instance: ServiceRegistry;
    
    private constructor() {}
    
    static getInstance(): ServiceRegistry {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry();
        }
        return ServiceRegistry.instance;
    }
    
    // Type-safe service getters
    get debugLogging(): DebugLoggingService | undefined {
        return sliceContainer.get('debug-logging') as DebugLoggingService;
    }
    
    get calendarNavigation(): CalendarNavigationService | undefined {
        return sliceContainer.get('calendar-navigation') as CalendarNavigationService;
    }
    
    get settings(): SettingsService | undefined {
        return sliceContainer.get('settings-management') as SettingsService;
    }
    
    get fileOperations(): FileOperationsService | undefined {
        return sliceContainer.get('file-operations') as FileOperationsService;
    }
    
    get ribbon(): RibbonService | undefined {
        return sliceContainer.get('ribbon-integration') as RibbonService;
    }
    
    get streamManagement(): StreamManagementService | undefined {
        return sliceContainer.get('stream-management') as StreamManagementService;
    }
    
    get mobileIntegration(): MobileIntegrationService | undefined {
        return sliceContainer.get('mobile-integration') as MobileIntegrationService;
    }
    
    get api(): APIService | undefined {
        return sliceContainer.get('api') as APIService;
    }
    
    get commandRegistration(): CommandRegistrationService | undefined {
        return sliceContainer.get('command-registration') as CommandRegistrationService;
    }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();
