import { configurationService } from './ConfigurationService';
import { DebugLoggingService } from '../slices/debug-logging';
import { StreamManagementService } from '../slices/stream-management';
import { APIService } from '../slices/api';
import { FileOperationsService } from '../slices/file-operations';
import { RibbonService } from '../slices/ribbon-integration';
import { MobileIntegrationService } from '../slices/mobile-integration';
import { CommandRegistrationService } from '../slices/command-registration';
import { ContextMenuService } from '../slices/context-menu';
import { ServiceCoordinator } from '../slices/calendar-navigation';
import { SettingsService } from '../slices/settings-management';

/**
 * Service configuration for metadata-driven registration
 */
export interface ServiceConfig {
    name: string;
    factory: () => any;
    dependencies?: string[];
}

/**
 * Service configurations
 */
export const SERVICE_CONFIGS: ServiceConfig[] = [
    // Foundational services
    {
        name: 'configuration',
        factory: () => configurationService
    },
    {
        name: 'debug-logging',
        factory: () => new DebugLoggingService()
    },
    {
        name: 'settings-management',
        factory: () => new SettingsService()
    },

    // Core services
    {
        name: 'api',
        factory: () => new APIService()
    },
    {
        name: 'stream-management',
        factory: () => new StreamManagementService()
    },

    // Feature services
    {
        name: 'calendar-navigation',
        factory: () => new ServiceCoordinator()
    },
    {
        name: 'file-operations',
        factory: () => new FileOperationsService()
    },
    {
        name: 'ribbon-integration',
        factory: () => new RibbonService()
    },
    {
        name: 'mobile-integration',
        factory: () => new MobileIntegrationService()
    },
    {
        name: 'command-registration',
        factory: () => new CommandRegistrationService()
    },
    {
        name: 'context-menu',
        factory: () => new ContextMenuService()
    }
];

/**
 * Get service configuration by name
 */
export function getServiceConfig(name: string): ServiceConfig | undefined {
    return SERVICE_CONFIGS.find(config => config.name === name);
}

/**
 * Get all service configurations
 */
export function getAllServiceConfigs(): ServiceConfig[] {
    return [...SERVICE_CONFIGS];
}
