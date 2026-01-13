/**
 * Centralized Configuration Service
 * Consolidates all configuration values from scattered files into a single, typed service
 * Follows clean code principles: Single Responsibility, Open/Closed, Interface Segregation
 */

import { BaseSliceService } from './BaseSlice';
import { StreamsSettings } from './types';

// Configuration interfaces for different categories
export interface ViewConfiguration {
    readonly CREATE_FILE_VIEW_TYPE: string;
    readonly CALENDAR_ENABLED_VIEW_TYPES: readonly string[];
}

export interface TimingConfiguration {
    readonly SHORT_DELAY: number;
    readonly STANDARD_DELAY: number;
    readonly INITIALIZATION_DELAY: number;
    readonly FILE_OPERATION_DELAY: number;
    readonly TOUCH_DELTA_THRESHOLD: number;
}

export interface FileSizeConfiguration {
    readonly SMALL_THRESHOLD: number;
    readonly MEDIUM_THRESHOLD: number;
}

export interface SystemLimitsConfiguration {
    readonly MAX_ERRORS: number;
    readonly MAX_HISTORY_SIZE: number;
    readonly MAX_METRICS: number;
}

export interface DefaultSettingsConfiguration {
    readonly streams: readonly [];
    readonly primaryStreamId: string | null;
    readonly showStreamsBarComponent: boolean;
    readonly reuseCurrentTab: boolean;

    readonly debugLoggingEnabled: boolean;
    readonly barStyle: 'default';
}

// Main configuration interface
export interface ApplicationConfiguration {
    readonly view: ViewConfiguration;
    readonly timing: TimingConfiguration;
    readonly fileSize: FileSizeConfiguration;
    readonly systemLimits: SystemLimitsConfiguration;
    readonly defaults: DefaultSettingsConfiguration;
}

// Configuration provider interface for dependency injection
export interface ConfigurationProvider {
    getViewConfig(): ViewConfiguration;
    getTimingConfig(): TimingConfiguration;
    getFileSizeConfig(): FileSizeConfiguration;
    getSystemLimitsConfig(): SystemLimitsConfiguration;
    getDefaultSettingsConfig(): DefaultSettingsConfiguration;
    getAllConfig(): ApplicationConfiguration;
}

/**
 * Centralized Configuration Service
 * Provides typed access to all application configuration values
 * Implements ConfigurationProvider interface for clean dependency injection
 */
export class ConfigurationService extends BaseSliceService implements ConfigurationProvider {
    private static instance: ConfigurationService;

    // Centralized configuration object
    private readonly config: ApplicationConfiguration = {
        view: {
            CREATE_FILE_VIEW_TYPE: 'streams-create-file-view',
            CALENDAR_ENABLED_VIEW_TYPES: [
                'file-explorer',
                'search',
                'graph',
                'markdown',
                'streams-install-meld-view',
                'streams-create-file-view',
                'streams-create-file-view-encrypted'
            ] as const
        },

        timing: {
            SHORT_DELAY: 10,
            STANDARD_DELAY: 100,
            INITIALIZATION_DELAY: 100,
            FILE_OPERATION_DELAY: 100,
            TOUCH_DELTA_THRESHOLD: 10
        } as const,

        fileSize: {
            SMALL_THRESHOLD: 1024,  // 1 KB
            MEDIUM_THRESHOLD: 5120  // 5 KB
        } as const,

        systemLimits: {
            MAX_ERRORS: 100,
            MAX_HISTORY_SIZE: 100,
            MAX_METRICS: 1000
        } as const,

        defaults: {
            streams: [],
            primaryStreamId: null,
            showStreamsBarComponent: true,
            reuseCurrentTab: false,

            debugLoggingEnabled: false,
            barStyle: 'default'
        } as const
    };

    private constructor() {
        super();
    }

    static getInstance(): ConfigurationService {
        if (!ConfigurationService.instance) {
            ConfigurationService.instance = new ConfigurationService();
        }
        return ConfigurationService.instance;
    }

    /**
     * Initialize the configuration service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Validate configuration on startup
        this.validateConfiguration();

        this.initialized = true;
        this.log('Configuration service initialized');
    }

    /**
     * Cleanup method required by BaseSliceService
     */
    cleanup(): void {
        // Configuration service doesn't need cleanup as it holds static data
        this.initialized = false;
    }

    /**
     * Get view-related configuration
     */
    getViewConfig(): ViewConfiguration {
        return this.config.view;
    }

    /**
     * Get timing-related configuration
     */
    getTimingConfig(): TimingConfiguration {
        return this.config.timing;
    }

    /**
     * Get file size-related configuration
     */
    getFileSizeConfig(): FileSizeConfiguration {
        return this.config.fileSize;
    }

    /**
     * Get system limits configuration
     */
    getSystemLimitsConfig(): SystemLimitsConfiguration {
        return this.config.systemLimits;
    }

    /**
     * Get default settings configuration
     */
    getDefaultSettingsConfig(): DefaultSettingsConfiguration {
        return this.config.defaults;
    }

    /**
     * Get complete configuration object
     */
    getAllConfig(): ApplicationConfiguration {
        return this.config;
    }

    /**
     * Validate configuration values
     * Throws error if configuration is invalid
     */
    private validateConfiguration(): void {
        // Validate timing values are positive
        Object.entries(this.config.timing).forEach(([key, value]) => {
            if (value <= 0) {
                throw new Error(`Invalid timing configuration: ${key} must be positive, got ${value}`);
            }
        });

        // Validate file size thresholds are positive and logical
        if (this.config.fileSize.SMALL_THRESHOLD <= 0) {
            throw new Error('SMALL_THRESHOLD must be positive');
        }
        if (this.config.fileSize.MEDIUM_THRESHOLD <= this.config.fileSize.SMALL_THRESHOLD) {
            throw new Error('MEDIUM_THRESHOLD must be greater than SMALL_THRESHOLD');
        }

        // Validate system limits are positive
        Object.entries(this.config.systemLimits).forEach(([key, value]) => {
            if (value <= 0) {
                throw new Error(`Invalid system limit: ${key} must be positive, got ${value}`);
            }
        });
    }

    /**
     * Get default settings as a writable object for settings service
     */
    getDefaultSettings(): StreamsSettings {
        return {
            streams: [...this.config.defaults.streams],
            primaryStreamId: this.config.defaults.primaryStreamId,
            showStreamsBarComponent: this.config.defaults.showStreamsBarComponent,
            reuseCurrentTab: this.config.defaults.reuseCurrentTab,

            debugLoggingEnabled: this.config.defaults.debugLoggingEnabled,
            barStyle: this.config.defaults.barStyle
        };
    }
}

// Export singleton instance
export const configurationService = ConfigurationService.getInstance();
