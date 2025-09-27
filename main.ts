import { Plugin } from 'obsidian';
import { Stream, StreamsSettings } from './src/shared/types';
import { sliceContainer, serviceRegistry, DEFAULT_SETTINGS, ServiceLoader } from './src/shared';
import { StreamsAPI } from './src/slices/api';


export default class StreamsPlugin extends Plugin implements StreamsAPI {
	settings: StreamsSettings;
	public log: any; // Will be set by DebugLoggingService

	async onload() {
		// Set up the container with this plugin instance
		sliceContainer.setPlugin(this);
		
		// Load settings
		await this.loadSettings();
		
		// Register and initialize all services
		ServiceLoader.registerAllServices();
		
		// Get debug logger
		this.log = serviceRegistry.debugLogging?.getLogger();
		
		// Initialize all services
		await ServiceLoader.initializeAllServices();
		
		this.log?.info('Streams plugin loaded with vertical slice architecture');
	}

	async onunload() {
		// Cleanup all services
		ServiceLoader.cleanupAllServices();
		this.log?.info('Streams plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Public API methods for external access
	setActiveStream(streamId: string, force?: boolean): void {
		serviceRegistry.streamManagement?.setActiveStream(streamId, force);
	}

	getActiveStream(): Stream | null {
		return serviceRegistry.streamManagement?.getActiveStream() || null;
	}

	// API Methods - Delegate to API service
	getStreams(): Stream[] {
		return serviceRegistry.api?.getStreams() || [...this.settings.streams];
	}

	getStream(streamId: string): Stream | null {
		return serviceRegistry.api?.getStream(streamId) || null;
	}

	getStreamsByFolder(folderPath: string): Stream[] {
		return serviceRegistry.api?.getStreamsByFolder(folderPath) || [];
	}

	getStreamForFile(filePath: string): Stream | null {
		return serviceRegistry.api?.getStreamForFile(filePath) || null;
	}

	getStreamsByIcon(icon: string): Stream[] {
		return serviceRegistry.api?.getStreamsByIcon(icon) || [];
	}

	getRibbonStreams(): Stream[] {
		return serviceRegistry.api?.getRibbonStreams() || [];
	}

	getCommandStreams(): Stream[] {
		return serviceRegistry.api?.getCommandStreams() || [];
	}

	getStreamInfo(streamId: string): any {
		return serviceRegistry.api?.getStreamInfo(streamId) || null;
	}

	getVersion(): any {
		return serviceRegistry.api?.getVersion() || { version: '1.0.0', minAppVersion: '0.15.0', name: 'Streams', id: 'streams' };
	}

	hasStream(streamId: string): boolean {
		return serviceRegistry.api?.hasStream(streamId) || false;
	}

	getStreamCount(): number {
		return serviceRegistry.api?.getStreamCount() || 0;
	}

	hasStreams(): boolean {
		return serviceRegistry.api?.hasStreams() || false;
	}
}
