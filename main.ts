import { Plugin } from 'obsidian';
import { Stream, StreamsSettings } from './src/shared/types';
import { sliceContainer, serviceRegistry, DEFAULT_SETTINGS, ServiceLoader } from './src/shared';
import { StreamsAPI } from './src/slices/api';
import { CreateFileView, CREATE_FILE_VIEW_TYPE } from './src/slices/file-operations/CreateFileView';
import { InstallMeldView, INSTALL_MELD_VIEW_TYPE } from './src/slices/file-operations/InstallMeldView';


export default class StreamsPlugin extends Plugin implements StreamsAPI {
	settings: StreamsSettings;
	public log: any; // Will be set by DebugLoggingService

	async onload() {
		sliceContainer.setPlugin(this);
		
		await this.loadSettings();
		
		// Register views directly in the main plugin
		this.registerView(
			CREATE_FILE_VIEW_TYPE,
			(leaf) => new CreateFileView(leaf, this.app, '', { 
				id: '', 
				name: '', 
				folder: '', 
				icon: 'book',
				showTodayInRibbon: false,
				addCommand: false,
				encryptThisStream: false
			})
		);
		
		this.registerView(
			INSTALL_MELD_VIEW_TYPE,
			(leaf) => new InstallMeldView(leaf, this.app, '', { 
				id: '', 
				name: '', 
				folder: '', 
				icon: 'book',
				showTodayInRibbon: false,
				addCommand: false,
				encryptThisStream: false
			}, new Date())
		);
		
		
		ServiceLoader.registerAllServices();
		
		this.log = serviceRegistry.debugLogging?.getLogger();
		
		await ServiceLoader.initializeAllServices();
		
		this.log?.info('Streams plugin loaded with vertical slice architecture');
	}

	async onunload() {
		ServiceLoader.cleanupAllServices();
		this.log?.info('Streams plugin unloaded');
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		
		// Migration: ensure barStyle exists
		if (!this.settings.barStyle) {
			this.settings.barStyle = 'default';
			await this.saveSettings();
		}
		
		// Migration: ensure encryptThisStream exists for existing streams
		let needsSave = false;
		for (const stream of this.settings.streams) {
			if (stream.encryptThisStream === undefined) {
				stream.encryptThisStream = false;
				needsSave = true;
			}
		}
		
		if (needsSave) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	setActiveStream(streamId: string, force?: boolean): void {
		serviceRegistry.streamManagement?.setActiveStream(streamId, force);
	}

	getActiveStream(): Stream | null {
		return serviceRegistry.streamManagement?.getActiveStream() || null;
	}

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

	getFileOperationsService(): any {
		return serviceRegistry.fileOperations;
	}
}
