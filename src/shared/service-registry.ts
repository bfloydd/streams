/**
 * Service Registry for managing service instances and providing type-safe access
 */

import { sliceContainer } from './container';
import { DebugLoggingService } from '../slices/debug-logging';
import { StreamManagementService } from '../slices/stream-management';
import { APIService } from '../slices/api';
import { FileOperationsService } from '../slices/file-operations';

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
    
    get streamManagement(): StreamManagementService | undefined {
        return sliceContainer.get('stream-management') as StreamManagementService;
    }
    
    get api(): APIService | undefined {
        return sliceContainer.get('api') as APIService;
    }
    
    get fileOperations(): FileOperationsService | undefined {
        return sliceContainer.get('file-operations') as FileOperationsService;
    }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance();
