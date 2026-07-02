import { Plugin } from 'obsidian';
import { Stream, StreamsSettings } from './src/shared/types';
import { sliceContainer, serviceRegistry, DEFAULT_SETTINGS, ServiceLoader } from './src/shared';
import { StreamsAPI, StreamInfo, PluginVersion } from './src/slices/api';
import { Logger } from './src/slices/debug-logging';
import { FileOperationsService } from './src/slices/file-operations';
import { getAllViewConfigs } from './src/shared/view-config';


export default class StreamsPlugin extends Plugin implements StreamsAPI {
	settings: StreamsSettings;
	public log: Logger | undefined;


	async onload() {
		sliceContainer.setPlugin(this);

		await this.loadSettings();

		ServiceLoader.registerAllServices();

		this.log = serviceRegistry.debugLogging?.getLogger();

		await ServiceLoader.initializeAllServices();

		// Register all views using the centralized configuration
		// Note: Views are registered after services to avoid conflicts with CalendarNavigationService
		this.registerViews();

		this.log?.info('Streams plugin loaded with vertical slice architecture');
	}

	async onunload() {
		ServiceLoader.cleanupAllServices();
		this.log?.info('Streams plugin unloaded');
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		// Migration: ensure primaryStreamId exists
		if (this.settings.primaryStreamId === undefined) {
			this.settings.primaryStreamId = null;
			await this.saveSettings();
		}

		// Migration: ensure encryptThisStream, disabled, and merge 'folder' into 'dateFormat' for existing streams
		let needsSave = false;
		for (const stream of this.settings.streams) {
			if (stream.encryptThisStream === undefined) {
				stream.encryptThisStream = false;
				needsSave = true;
			}
			if (stream.disabled === undefined) {
				stream.disabled = false;
				needsSave = true;
			}

			// Ensure dateFormat has a default if missing
			if (stream.dateFormat === undefined) {
				stream.dateFormat = 'YYYY-MM-DD';
				needsSave = true;
			}

			// Migration: merge 'folder' into 'dateFormat' and delete 'folder'
			if (stream.folder !== undefined) {
				let newDateFormat = stream.dateFormat;
				if (!newDateFormat.includes('{') && !newDateFormat.includes('}')) {
					newDateFormat = `{${newDateFormat}}`;
				}

				if (stream.folder.trim() !== '') {
					// Clean folder slashes
					let cleanFolder = stream.folder.trim().replace(/\/+$/, '');

					// If the legacy dateFormat was an absolute path, it overrides the folder
					// (as per previous backward compatibility logic). So only prefix if it's not absolute.
					if (!stream.dateFormat.startsWith('/')) {
						stream.dateFormat = `${cleanFolder}/${newDateFormat}`;
					} else {
						stream.dateFormat = newDateFormat;
					}
				} else {
					stream.dateFormat = newDateFormat;
				}

				// Remove the deprecated property
				delete stream.folder;
				needsSave = true;
			}
		}

		// Cleanup: Remove legacy activeStreamId and calendarCompactState
		if ((this.settings as any).activeStreamId !== undefined) {
			delete (this.settings as any).activeStreamId;
			needsSave = true;
		}
		if ((this.settings as any).calendarCompactState !== undefined) {
			delete (this.settings as any).calendarCompactState;
			needsSave = true;
		}

		if (needsSave) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Registers all views using configuration-driven approach
	 * This method centralizes view registration logic and makes it easier to add new views.
	 */
	private registerViews(): void {
		const viewConfigs = getAllViewConfigs();
		for (const config of viewConfigs) {
			this.registerView(
				config.viewType,
				(leaf) => {
					// Create the view instance with proper arguments
					if (config.extraArgs) {
						return new config.ViewClass(leaf, this.app, '', config.defaultSettings, ...config.extraArgs);
					} else {
						return new config.ViewClass(leaf, this.app, '', config.defaultSettings);
					}
				}
			);
		}
	}

	// ============================================================================
	// PUBLIC API METHODS - Available to other plugins
	// ============================================================================

	// Stream Management methods removed (global active stream deprecated)

	// Stream Data Access
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

	getStreamInfo(streamId: string): StreamInfo | null {
		return serviceRegistry.api?.getStreamInfo(streamId) || null;
	}

	// Stream Status & Information
	hasStream(streamId: string): boolean {
		return serviceRegistry.api?.hasStream(streamId) || false;
	}

	getStreamCount(): number {
		return serviceRegistry.api?.getStreamCount() || 0;
	}

	hasStreams(): boolean {
		return serviceRegistry.api?.hasStreams() || false;
	}

	getVersion(): PluginVersion {
		return serviceRegistry.api?.getVersion() || { version: '1.0.0', minAppVersion: '0.15.0', name: 'Streams', id: 'streams' };
	}

	// Internal Services (for plugin functionality)
	getFileOperationsService(): FileOperationsService | undefined {
		return serviceRegistry.fileOperations;
	}
}
