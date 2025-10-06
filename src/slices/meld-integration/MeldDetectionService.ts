import { App } from 'obsidian';
import { PluginAwareSliceService } from '../../shared/base-slice';
import { centralizedLogger } from '../../shared/centralized-logger';

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
        try {
            const app = this.getPlugin().app;
            
            // Check if the Meld plugin is installed and enabled
            const plugins = (app as any).plugins?.plugins;
            if (!plugins) return false;
            
            // Check for Meld plugin
            const meldPlugin = plugins['meld-encrypt'];
            if (!meldPlugin) return false;
            
            // Check if the specific command exists
            const commands = (app as any).commands?.commands;
            if (!commands) return false;
            
            return !!commands[this.meldCommandId];
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
        try {
            if (!this.isMeldPluginAvailable()) {
                throw new Error('Meld plugin is not available or not enabled');
            }
            
            const app = this.getPlugin().app;
            const command = (app as any).commands?.commands?.[this.meldCommandId];
            
            if (command) {
                await command.callback();
                return true;
            } else {
                throw new Error(`Meld encryption command not found: ${this.meldCommandId}`);
            }
        } catch (error) {
            centralizedLogger.error('Error executing Meld encryption command:', error);
            return false;
        }
    }
    
    /**
     * Get a user-friendly error message for when Meld is not available
     */
    getMeldUnavailableMessage(): string {
        return 'Meld plugin is not installed or not enabled. Please install and enable the Meld plugin to use encryption features.';
    }
}
