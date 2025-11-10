import { App } from 'obsidian';
import { PluginAwareSliceService } from '../../shared/base-slice';
import { centralizedLogger } from '../../shared/centralized-logger';
import { getPlugins, getCommands } from '../../shared/obsidian-types';
import { withErrorHandling, withAsyncErrorHandling } from '../../shared/error-handler';

/**
 * Service for detecting and validating Meld plugin availability
 */
export class MeldDetectionService extends PluginAwareSliceService {
    private meldCommandId = 'meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note';
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }
    
    cleanup(): void {
        this.initialized = false;
    }
    
    /**
     * Check if Meld plugin is installed and enabled
     */
    isMeldPluginAvailable(): boolean {
        const app = this.getPlugin().app;
        return MeldDetectionService.checkMeldAvailability(app);
    }
    
    /**
     * Static helper to check Meld availability without requiring a plugin instance
     * Useful for utility functions that don't have plugin context
     */
    static checkMeldAvailability(app: App): boolean {
        try {
            // Check if the Meld plugin is installed and enabled
            const plugins = getPlugins(app);
            if (!plugins) return false;
            
            // Check for Meld plugin
            const meldPlugin = plugins['meld-encrypt'];
            if (!meldPlugin) return false;
            
            // Check if the specific command exists
            const commands = getCommands(app);
            if (!commands) return false;
            
            const meldCommandId = 'meld-encrypt:meld-encrypt-convert-to-or-from-encrypted-note';
            return !!commands[meldCommandId];
        } catch (error) {
            centralizedLogger.error('Error checking Meld plugin availability:', error);
            return false;
        }
    }
    
    /**
     * Get the Meld encryption command ID
     */
    getMeldCommandId(): string {
        return this.meldCommandId;
    }
    
    /**
     * Execute the Meld encryption command
     */
    async executeMeldEncryption(): Promise<boolean> {
        if (!this.isMeldPluginAvailable()) {
            throw new Error('Meld plugin is not available or not enabled');
        }

        const app = this.getPlugin().app;
        const commands = getCommands(app);
        const command = commands?.[this.meldCommandId];

        if (command?.callback) {
            await command.callback();
            return true;
        } else {
            throw new Error(`Meld encryption command not found: ${this.meldCommandId}`);
        }
    }
    
    /**
     * Get a user-friendly error message for when Meld is not available
     */
    getMeldUnavailableMessage(): string {
        return 'Meld plugin is not installed or not enabled. Please install and enable the Meld plugin to use encryption features.';
    }
}
