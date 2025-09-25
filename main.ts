import { App, MarkdownView, Notice, Plugin, WorkspaceLeaf, Platform, TFile } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings, LucideIcon } from './types';
import { CalendarComponent } from './src/components/CalendarComponent';
import { Logger, LogLevel } from './src/utils/Logger';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from './src/commands/OpenTodayCurrentStreamCommand';
import { StreamSelectionModal } from './src/modals/StreamSelectionModal';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from './src/views/CreateFileView';
import { ToggleDebugLoggingCommand } from './src/commands/ToggleDebugLoggingCommand';

const DEFAULT_SETTINGS: StreamsSettings = {
	streams: [],
	showCalendarComponent: true,
	reuseCurrentTab: false,
	activeStreamId: undefined,
	debugLoggingEnabled: false
}

export default class StreamsPlugin extends Plugin {
	settings: StreamsSettings;
	private ribbonIconsByStream: Map<string, {today?: HTMLElement}> = new Map();
	commandsByStreamId: Map<string, string> = new Map();
	private calendarComponents: Map<string, CalendarComponent> = new Map();
	public log: Logger;
	private isInitializing: boolean = true;

	async onload() {
		this.log = new Logger('Streams');
		
		await this.loadSettings();
		
		// Initialize logging based on settings
		if (this.settings.debugLoggingEnabled) {
			this.log.on(LogLevel.DEBUG);
		}
		
		// Log the restored active stream state
		if (this.settings.activeStreamId) {
			const activeStream = this.settings.streams.find(s => s.id === this.settings.activeStreamId);
			this.log.debug(`Restored active stream: ${activeStream?.name || 'Unknown'} (${this.settings.activeStreamId})`);
		}
		
		this.registerPluginViews();
		this.registerEventHandlers();
		this.initializeAllRibbonIcons();
		this.initializeStreamCommands();
		this.initializeMobileIntegration();
		this.registerCalendarCommands();
		this.registerLogCommands();

		this.addSettingTab(new StreamsSettingTab(this.app, this));
		this.initializeActiveView();
		this.logInitialState();
		
		// Set up DOM observer to prevent duplicates
		this.setupDuplicatePrevention();
		
		// Create global stream indicator
		this.createGlobalStreamIndicator();
		
		// No need for dynamic positioning - CSS handles it automatically
		
		this.isInitializing = false;
		this.log.info('Streams plugin loaded');
	}
	
	/**
	 * Register commands for controlling logging
	 */
	private registerLogCommands(): void {
		// Add a command to enable/disable logging
		this.addCommand({
			id: 'toggle-logging',
			name: 'Toggle debug logging',
			callback: () => {
				const command = new ToggleDebugLoggingCommand(
					this.app, 
					this.log, 
					(enabled: boolean) => {
						this.settings.debugLoggingEnabled = enabled;
					},
					async () => {
						await this.saveSettings();
					}
				);
				command.execute();
			}
		});
		
		// Add a command to show current active stream
		this.addCommand({
			id: 'show-active-stream',
			name: 'Show current active stream',
			callback: () => {
				const activeStream = this.getActiveStream();
				if (activeStream) {
					new Notice(`Active stream: ${activeStream.name}`);
					this.log.debug(`Active stream: ${activeStream.name} (${activeStream.id})`);
				} else {
					new Notice('No active stream set');
					this.log.debug('No active stream set');
				}
			}
		});
		
		// Add a command to restore active stream from settings
		this.addCommand({
			id: 'restore-active-stream',
			name: 'Restore active stream from settings',
			callback: () => {
				if (this.settings.activeStreamId) {
					const activeStream = this.settings.streams.find(s => s.id === this.settings.activeStreamId);
					if (activeStream) {
						new Notice(`Restored active stream: ${activeStream.name}`);
						this.log.debug(`Manually restored active stream: ${activeStream.name} (${activeStream.id})`);
					} else {
						new Notice('Active stream ID not found in streams list');
						this.log.debug(`Active stream ID ${this.settings.activeStreamId} not found in streams list`);
					}
				} else {
					new Notice('No active stream ID in settings');
					this.log.debug('No active stream ID in settings to restore');
				}
			}
		});

		// Add a command to force refresh all calendar components
		this.addCommand({
			id: 'force-refresh-calendar-components',
			name: 'Force refresh all calendar components',
			callback: () => {
				this.forceRefreshAllCalendarComponents();
				new Notice('Calendar components refreshed');
			}
		});
		
		// Add a command to debug calendar component state
		this.addCommand({
			id: 'debug-calendar-components',
			name: 'Debug calendar component state',
			callback: () => {
				this.log.debug('=== Calendar Component Debug Info ===');
				this.log.debug(`Total calendar components: ${this.calendarComponents.size}`);
				this.log.debug('Component IDs:', Array.from(this.calendarComponents.keys()));
				
				const allLeaves = this.app.workspace.getLeavesOfType('markdown');
				this.log.debug(`Total markdown leaves: ${allLeaves.length}`);
				
				allLeaves.forEach((leaf, index) => {
					const view = leaf.view as MarkdownView;
					if (view?.file?.path) {
						const filePath = view.file.path;
						const leafHash = this.hashLeaf(leaf);
						const componentId = `${filePath}-${leafHash}`;
						const hasComponent = this.calendarComponents.has(componentId);
						
						this.log.debug(`Leaf ${index}: ${filePath} | Hash: ${leafHash} | ComponentId: ${componentId} | HasComponent: ${hasComponent}`);
					}
				});
				
				new Notice('Calendar component debug info logged to console');
			}
		});

		// Add a command to show calendar component status
		this.addCommand({
			id: 'show-calendar-component-status',
			name: 'Show calendar component status',
			callback: () => {
				const totalComponents = this.calendarComponents.size;
				const openFiles = this.app.workspace.getLeavesOfType('markdown').length;
				
				new Notice(`Calendar components: ${totalComponents}/${openFiles} files`);
				this.log.debug(`Calendar component status: ${totalComponents}/${openFiles} files`);
			}
		});

		// Add a command to refresh global stream indicator
		this.addCommand({
			id: 'refresh-global-stream-indicator',
			name: 'Refresh global stream indicator',
			callback: () => {
				this.createGlobalStreamIndicator();
				new Notice('Global stream indicator refreshed');
			}
		});

		// Add a command to manually clear all stream commands (for debugging)
		this.addCommand({
			id: 'clear-all-stream-commands',
			name: 'Clear all stream commands',
			callback: () => {
				this.clearAllStreamCommands();
				new Notice('All stream commands cleared');
			}
		});

		// Add a command to debug what commands are registered
		this.addCommand({
			id: 'debug-stream-commands',
			name: 'Debug stream commands',
			callback: () => {
				this.debugStreamCommands();
			}
		});

		// Add a command to force complete plugin restart
		this.addCommand({
			id: 'force-plugin-restart',
			name: 'Force plugin restart (nuclear option)',
			callback: () => {
				this.forcePluginRestart();
			}
		});

		// No positioning commands needed - CSS handles it automatically
	}
	
	private logInitialState(): void {
		this.settings.streams.forEach(stream => {
			this.log.debug(`Stream ${stream.name}: Today=${stream.showTodayInRibbon}`);
		});
		
		if (this.settings.activeStreamId) {
			const activeStream = this.settings.streams.find(s => s.id === this.settings.activeStreamId);
			this.log.debug(`Active stream: ${activeStream?.name || 'Unknown'}`);
		}
	}
	
	private registerPluginViews(): void {
		// Register CreateFileView
		this.registerView(
			CREATE_FILE_VIEW_TYPE,
			(leaf) => new CreateFileView(leaf, this.app, "", { 
				id: "", 
				name: "", 
				folder: "", 
				icon: "calendar", 
				showTodayInRibbon: false, 
				addCommand: false, 
			}, new Date())
		);
		
		
	}
	
	
	public initializeAllRibbonIcons(): void {
		// Create icons for all streams (even if hidden)
		this.settings.streams.forEach(stream => {
			this.createStreamIcons(stream);
		});
		
		// Update visibility based on settings
		this.updateAllIconVisibility();
	}
	
	private createAllStreamsIcon(): void {
		// Open Current Stream Today button
		this.addRibbonIcon(
			'calendar',
			'Streams: Open today for current stream',
			() => {
				const command = new OpenTodayCurrentStreamCommand(this.app, this.settings.streams, this.settings.reuseCurrentTab, this);
				command.execute();
			}
		);
	}

	private createStreamIcons(stream: Stream): void {
		// Get or create entry for this stream
		let streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (!streamIcons) {
			streamIcons = {};
			this.ribbonIconsByStream.set(stream.id, streamIcons);
		}
		
		// ALWAYS create the icon, regardless of visibility setting
		if (!streamIcons.today) {
			this.log.debug(`Creating Today icon for stream ${stream.id}`);
			
			streamIcons.today = this.addRibbonIcon(
				stream.icon,
				`Streams: ${stream.name}, today`,
				() => {
					const command = new OpenTodayStreamCommand(this.app, stream, this.settings.reuseCurrentTab);
					command.execute();
				}
			);
			
			// Set initial visibility
			this.updateIconVisibility(streamIcons.today, stream.showTodayInRibbon);
		}
	}
	
	

	public updateAllIconVisibility(): void {
		this.settings.streams.forEach(stream => {
			this.updateStreamIconVisibility(stream);
		});
	}
	
	public updateStreamIconVisibility(stream: Stream): void {
		console.log(`updateStreamIconVisibility called for ${stream.name}, showTodayInRibbon: ${stream.showTodayInRibbon}`);
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		console.log(`Stream icons found:`, streamIcons);
		
		if (streamIcons && streamIcons.today) {
			console.log(`Updating icon visibility for ${stream.name}`);
			// Just update the CSS visibility - don't create/remove icons
			this.updateIconVisibility(streamIcons.today, stream.showTodayInRibbon);
		} else {
			console.log(`No icon found for ${stream.name}`);
		}
	}
	
	
	
	public removeAllRibbonIcons(): void {
		this.ribbonIconsByStream.forEach((icons) => {
			if (icons.today) icons.today.detach();
		});
		this.ribbonIconsByStream.clear();
	}
	
	onunload() {
		this.log.debug('Unloading Streams plugin');
		
		this.cleanupResources();
		this.log.debug('Streams plugin unloaded');
	}

	private cleanupResources(): void {
		this.removeAllRibbonIcons();
		
		this.calendarComponents.forEach(component => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
		// Clean up global stream indicator
		const existingIndicator = document.querySelector('.streams-global-indicator');
		if (existingIndicator) {
			existingIndicator.remove();
		}
		
		// No observers to clean up
		
		this.commandsByStreamId.clear();
	}
	
	private registerEventHandlers(): void {
		// Handle active leaf changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				this.log.debug('Active leaf changed');
				// Add a small delay to ensure the view is fully initialized
				setTimeout(() => {
					if (leaf?.view instanceof MarkdownView) {
						this.updateCalendarComponent(leaf);
					} else if (leaf?.view.getViewType() === CREATE_FILE_VIEW_TYPE) {
						this.updateCalendarComponentForCreateView(leaf);
					}
				}, 100);
			})
		);

		// Handle new leaves being created (new tabs opened) and layout changes
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Small delay to ensure new views are fully initialized
				setTimeout(() => {
					this.refreshCalendarComponentsForNewViews();
				}, 200);
			})
		);
		
		// Handle when leaves become visible (e.g., when switching between split views)
		this.registerEvent(
			this.app.workspace.on('resize', () => {
				// Small delay to ensure the resize is complete
				setTimeout(() => {
					this.refreshCalendarComponentsForNewViews();
				}, 100);
			})
		);

		// Handle file open events to ensure calendar components are created
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file) {
					this.log.debug(`File opened: ${file.path}`);
					// Small delay to ensure the view is fully initialized
					setTimeout(() => {
						this.ensureCalendarComponentForFile(file.path);
					}, 100);
				}
			})
		);

		// Update calendar when create file state changes
		this.registerEvent(
			// @ts-ignore - Custom event not in Obsidian type definitions
			this.app.workspace.on('streams-create-file-state-changed', (view: { leaf?: WorkspaceLeaf }) => {
				this.log.debug('Create file state changed, updating calendar component');
				if (view && view.leaf) {
					this.updateCalendarComponentForCreateView(view.leaf);
				}
			})
		);
	}
	
	private initializeMobileIntegration(): void {
		// Add share handler for Android
		if (Platform.isAndroidApp) {
			this.registerEvent(
				this.app.workspace.on('file-menu', (menu, file) => {
					if (file && this.settings.streams.length > 0) {
						menu.addItem((item) => {
							item
								.setTitle('Insert link into stream')
								.setIcon('link')
								.onClick(async () => {
									await this.showStreamSelectionModal(file.path);
								});
						});
					}
				})
			);
		}
	}
	
	private initializeActiveView(): void {
		this.log.debug('Initializing calendar components for all open views');
		
		const allLeaves = this.app.workspace.getLeavesOfType('markdown');
		this.log.debug(`Found ${allLeaves.length} open markdown leaves`);
		
		allLeaves.forEach(leaf => {
			const view = leaf.view as MarkdownView;
			if (view?.file?.path) {
				const filePath = view.file.path;
				const leafHash = this.hashLeaf(leaf);
				const componentId = `${filePath}-${leafHash}`;
				
				if (!this.calendarComponents.has(componentId)) {
					this.log.debug(`Creating calendar component for file: ${filePath} in leaf: ${leafHash}`);
					this.updateCalendarComponent(leaf);
				} else {
					this.log.debug(`Calendar component already exists for file: ${filePath} in leaf: ${leafHash}`);
				}
			}
		});
		
		this.log.debug(`Initialized ${this.calendarComponents.size} calendar components`);
	}

	public updateCalendarComponent(leaf: WorkspaceLeaf) {
		if (!this.settings.showCalendarComponent) {
			this.removeAllCalendarComponents();
			return;
		}

		const view = leaf.view as MarkdownView;
		const filePath = view.file?.path;
		const stream = (filePath ? this.getStreamForFile(filePath) : null) || this.getDefaultStream();
		
		// Create calendar component (DOM observer will handle duplicates)
		const component = new CalendarComponent(leaf, stream, this.app, this.settings.reuseCurrentTab, this.settings.streams, this);
		this.calendarComponents.set('single-component', component);
	}

	private async showStreamSelectionModal(filePath: string) {
		const modal = new StreamSelectionModal(this.app, this.settings.streams, async (selectedStream) => {
			if (selectedStream) {
				await this.insertLinkIntoStream(selectedStream, filePath);
			}
		});
		modal.open();
	}

	private async insertLinkIntoStream(stream: Stream, filePath: string) {
		try {
			// Get today's stream note
			const date = new Date();
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const fileName = `${year}-${month}-${day}.md`;
			const streamPath = `${stream.folder}/${fileName}`;

			// Create or get the stream note
			let file = this.app.vault.getAbstractFileByPath(streamPath);
			if (!file || !(file instanceof TFile)) {
				file = await this.app.vault.create(streamPath, '');
			}

			if (file instanceof TFile) {
				// Get the file to link to
				const linkFile = this.app.vault.getAbstractFileByPath(filePath);
				if (!linkFile || !(linkFile instanceof TFile)) {
					new Notice('Could not find file to link to');
					return;
				}

				// Create and append the link
				const link = this.app.fileManager.generateMarkdownLink(linkFile, streamPath);
				await this.app.vault.append(file, (await this.app.vault.read(file)).length > 0 ? '\n' + link : link);

				new Notice(`Added link to ${stream.name}`);
			}
		} catch (error) {
			this.log.error('Error inserting link:', error);
			new Notice('Failed to insert link into stream');
		}
	}

	public updateCalendarComponentForCreateView(leaf: WorkspaceLeaf) {
		const view = leaf.view;
		if (!view) {
			this.log.debug('Cannot update calendar component: no view found');
			return;
		}
		
		// Only clean up create file view components
		const state = view.getState();
		if (state?.stream) {
			const stream = state.stream as Stream;
			const leafHash = this.hashLeaf(leaf);
			const componentId = `create-file-view-${stream.id}-${leafHash}`;
			const existingComponent = this.calendarComponents.get(componentId);
			if (existingComponent) {
				existingComponent.destroy();
				this.calendarComponents.delete(componentId);
			}
		}
		
		if (!this.settings.showCalendarComponent) {
			this.log.debug('Calendar component is disabled in settings');
			return;
		}
		
		try {
			// Get stream and date from view state
			const state = view.getState();
			if (!state) {
				this.log.debug('No state found in create file view');
				return;
			}
			
			if (!state.stream || !state.date) {
				this.log.debug('Missing stream or date in create file view state', {
					hasStream: !!state.stream,
					hasDate: !!state.date
				});
				return;
			}
			
			const stream = state.stream as Stream;
			const dateString = state.date as string;
			const date = new Date(dateString);
			
			this.log.debug('Creating calendar component for create file view:', {
				stream: stream.name,
				date: date.toISOString()
			});
			
			// Create the calendar component
			const component = new CalendarComponent(leaf, stream, this.app, this.settings.reuseCurrentTab, this.settings.streams, this);
			
			// Set current viewed date
			const formattedDate = dateString.split('T')[0];
			component.setCurrentViewedDate(formattedDate);
			
			// Don't automatically set active stream from calendar component updates
			// Active stream should only be set by explicit user actions
			this.log.debug('Calendar component for create view created - not setting active stream automatically');
			
			const leafHash = this.hashLeaf(leaf);
			const componentId = `create-file-view-${stream.id}-${leafHash}`;
			this.calendarComponents.set(componentId, component);
			
			this.log.debug('Calendar component for create file view created successfully');
		} catch (error) {
			this.log.error('Error setting up calendar component for create view:', error);
		}
	}


	public updateAllCalendarComponents() {
		this.calendarComponents.forEach(component => {
			component.updateStreamsList(this.settings.streams);
		});
	}

	public forceRefreshAllCalendarComponents() {
		this.refreshCalendarComponentsForNewViews();
	}

	/**
	 * Remove all calendar components from DOM and memory
	 * Simple and reliable cleanup
	 */
	private removeAllCalendarComponents() {
		// Remove from memory
		this.calendarComponents.forEach(component => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
		// Remove from DOM
		const existingComponents = document.querySelectorAll('.streams-calendar-component');
		existingComponents.forEach(component => {
			component.remove();
		});
	}


	public refreshCalendarComponentsForNewViews() {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
			this.updateCalendarComponent(activeLeaf);
		}
	}

	public ensureCalendarComponentForFile(filePath: string) {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
			this.updateCalendarComponent(activeLeaf);
		}
	}


	private getStreamForFile(filePath: string): Stream | null {
		if (!filePath) return null;
		
		return this.settings.streams.find(stream => {
			// Skip streams with empty folders
			if (!stream.folder || stream.folder.trim() === '') {
				return false;
			}
			
			// Normalize paths for comparison
			const normalizedFilePath = filePath.split(/[/\\]/).filter(Boolean);
			const normalizedStreamPath = stream.folder.split(/[/\\]/).filter(Boolean);
			
			// Check if the file path starts with the stream path
			return normalizedStreamPath.every((part, index) => {
				// Check bounds
				if (index >= normalizedFilePath.length) {
					return false;
				}
				return normalizedStreamPath[index] === normalizedFilePath[index];
			});
		}) || null;
	}

	private getDefaultStream(): Stream {
		// Return the first available stream, or create a default one if none exist
		if (this.settings.streams.length > 0) {
			return this.settings.streams[0];
		}
		
		// Create a default stream if none exist
		return {
			id: "default",
			name: "Default Stream",
			folder: "",
			icon: "file-text",
			showTodayInRibbon: false,
			addCommand: false,
		};
	}

	private setupDuplicatePrevention(): void {
		// Set up a DOM observer to catch and remove duplicate calendar components
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					const calendarComponents = document.querySelectorAll('.streams-calendar-component');
					if (calendarComponents.length > 1) {
						// Keep only the first one, remove the rest
						for (let i = 1; i < calendarComponents.length; i++) {
							calendarComponents[i].remove();
						}
					}
				}
			});
		});

		// Start observing
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	private createGlobalStreamIndicator(): void {
		// Create a global stream indicator that's always visible
		// Use the status bar container that Obsidian provides
		const statusBarContainer = document.querySelector('.status-bar');
		if (!statusBarContainer) return;
		
		// Remove existing indicator if it exists
		const existingIndicator = document.querySelector('.streams-global-indicator');
		if (existingIndicator) {
			existingIndicator.remove();
		}
		
		// Create the global indicator
		const indicator = statusBarContainer.createEl('div', {
			cls: 'streams-global-indicator',
			text: this.getGlobalStreamIndicatorText()
		});
		
		// Add click handler to show stream selection
		indicator.addEventListener('click', () => {
			this.showGlobalStreamSelection();
		});
		
		this.log.debug('Global stream indicator created');
	}

	private getGlobalStreamIndicatorText(): string {
		if (this.settings.activeStreamId) {
			const activeStream = this.settings.streams.find(s => s.id === this.settings.activeStreamId);
			if (activeStream) {
				return `📅 ${activeStream.name}`;
			}
		}
		return '📅 No Stream';
	}

	private showGlobalStreamSelection(): void {
		// Show a simple stream selection modal
		const modal = new StreamSelectionModal(this.app, this.settings.streams, async (selectedStream) => {
			if (selectedStream) {
				this.setActiveStream(selectedStream.id, true);
				this.updateGlobalStreamIndicator();
			}
		});
		modal.open();
	}

	private updateGlobalStreamIndicator(): void {
		const indicator = document.querySelector('.streams-global-indicator');
		if (indicator) {
			indicator.setText(this.getGlobalStreamIndicatorText());
		} else {
			// If indicator doesn't exist, recreate it
			this.log.debug('Global stream indicator not found, recreating');
			this.createGlobalStreamIndicator();
		}
	}

	private ensureGlobalStreamIndicator(): void {
		const indicator = document.querySelector('.streams-global-indicator');
		if (!indicator) {
			this.log.debug('Global stream indicator missing, creating');
			this.createGlobalStreamIndicator();
		}
	}

	// Positioning is now handled automatically by CSS - no JavaScript needed
	
	/**
	 * Create a unique identifier for a WorkspaceLeaf
	 * This helps distinguish between different leaves even when they display the same file
	 */
	private hashLeaf(leaf: WorkspaceLeaf): string {
		// Use the leaf's position in the workspace as a unique identifier
		// This ensures different leaves get different IDs even when showing the same file
		const workspace = this.app.workspace;
		const allLeaves = workspace.getLeavesOfType('markdown');
		const leafIndex = allLeaves.indexOf(leaf);
		
		// If we can't find the leaf index, fall back to a timestamp-based approach
		if (leafIndex === -1) {
			this.log.warn(`Could not find leaf index for leaf, using fallback identifier`);
			return `leaf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		}
		
		return `leaf-${leafIndex}`;
	}
	
	/**
	 * Set the currently active stream
	 */
	public setActiveStream(streamId: string, force: boolean = false): void {
		const previousStreamId = this.settings.activeStreamId;
		
		// Block changes during initialization unless forced
		if (this.isInitializing && previousStreamId && previousStreamId !== streamId && !force) {
			this.log.debug(`Blocked active stream change during initialization: ${previousStreamId} → ${streamId}`);
			return;
		}
		
		// Block automatic changes unless forced
		if (!force && !this.isInitializing && previousStreamId && previousStreamId !== streamId) {
			this.log.debug(`Blocked automatic active stream change: ${previousStreamId} → ${streamId}`);
			return;
		}
		
		this.settings.activeStreamId = streamId;
		this.saveSettings();
		
		if (previousStreamId !== streamId) {
			// Remove all existing calendar components when switching streams
			this.removeAllCalendarComponents();
			
			// Update the global stream indicator
			this.updateGlobalStreamIndicator();
		}
	}
	
	/**
	 * Get the currently active stream
	 */
	public getActiveStream(): Stream | null {
		if (!this.settings.activeStreamId) {
			return null;
		}
		
		const activeStream = this.settings.streams.find(s => s.id === this.settings.activeStreamId);
		if (!activeStream) {
			// Clear invalid active stream ID
			this.log.debug(`Invalid active stream ID found: ${this.settings.activeStreamId}, clearing it`);
			this.settings.activeStreamId = undefined;
			this.saveSettings();
			return null;
		}
		
		return activeStream;
	}
	
	/**
	 * Clear the currently active stream
	 */
	public clearActiveStream(): void {
		const previousStreamId = this.settings.activeStreamId;
		this.settings.activeStreamId = undefined;
		this.saveSettings();
		this.log.debug(`Cleared active stream: ${previousStreamId || 'None'}`);
	}
	
	/**
	 * Get debug information about the current active stream state
	 */
	public getActiveStreamDebugInfo(): string {
		const activeStream = this.getActiveStream();
		const currentFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
		const currentFilePath = currentFile?.path;
		
		let info = `Active Stream: ${activeStream?.name || 'None'}\n`;
		info += `Current File: ${currentFilePath || 'None'}\n`;
		info += `Initialization Complete: ${!this.isInitializing}\n`;
		
		if (currentFilePath) {
			const matchingStream = this.settings.streams.find(s => {
				if (!s.folder || s.folder.trim() === '') return false;
				const normalizedFilePath = currentFilePath.split(/[/\\]/).filter(Boolean);
				const normalizedStreamPath = s.folder.split(/[/\\]/).filter(Boolean);
				return normalizedStreamPath.every((part, index) => 
					index < normalizedFilePath.length && normalizedStreamPath[index] === normalizedFilePath[index]
				);
			});
			info += `File Belongs To Stream: ${matchingStream?.name || 'None'}\n`;
		}
		
		return info;
	}
	
	/**
	 * Force set initialization state (for testing purposes)
	 */
	public setInitializationState(isInitializing: boolean): void {
		this.isInitializing = isInitializing;
		this.log.debug(`Initialization state: ${isInitializing}`);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		if (this.settings.activeStreamId) {
			this.log.debug(`Loaded active stream ID: ${this.settings.activeStreamId}`);
		}
		
		// Ensure default values are set
		if (this.settings.showCalendarComponent === undefined) {
			this.settings.showCalendarComponent = true;
		}
		
		if (this.settings.reuseCurrentTab === undefined) {
			this.settings.reuseCurrentTab = false;
		}
		
		if (this.settings.debugLoggingEnabled === undefined) {
			this.settings.debugLoggingEnabled = false;
		}
		
		// Migrate existing streams
		this.settings.streams.forEach(stream => {
			this.migrateStreamSettings(stream);
		});
		
		// Save the cleaned settings after migration
		await this.saveSettings();
	}
	
	private migrateStreamSettings(stream: Stream): void {
		
		// Migrate from old property names
		const streamAny = stream as any; // Temporary for migration
		if (streamAny.showInRibbon !== undefined && stream.showTodayInRibbon === undefined) {
			stream.showTodayInRibbon = streamAny.showInRibbon;
			delete streamAny.showInRibbon;
		}
		
		// Remove deprecated properties that are no longer used
		delete streamAny.viewIcon;
		delete streamAny.showFullStreamInRibbon;
		delete streamAny.addViewCommand;
		delete streamAny.showTodayBorder;
		delete streamAny.showViewBorder;
		delete streamAny.todayBorderColor;
		delete streamAny.viewBorderColor;
		
		// Set default values if undefined
		if (stream.showTodayInRibbon === undefined) {
			stream.showTodayInRibbon = false;
		}
		
		if (stream.addCommand === undefined) {
			stream.addCommand = false;
		}
	}

	async saveSettings(refreshUI: boolean = false) {
		try {
			await this.saveData(this.settings);
			this.log.debug("Settings saved");
			
			this.logSavedSettings();
		} catch (error) {
			this.log.error("Error saving settings:", error);
		}
	}
	
	private logSavedSettings(): void {
		this.settings.streams.forEach(stream => {
			this.log.debug(`Stream ${stream.name}: Today=${stream.showTodayInRibbon}`);
		});
	}

	
	public toggleStreamCommand(stream: Stream) {
		// Remove existing command first
		this.removeStreamCommand(stream.id);
		
		// Also remove ribbon icon command if it exists
		const ribbonCommandId = `Streams: ${stream.name}, today`;
		try {
			this.removeCommand(ribbonCommandId);
			this.log.debug(`Removed ribbon command: ${ribbonCommandId}`);
		} catch (error) {
			// Command might not exist, which is fine
		}
		
		// Add if enabled
		if (stream.addCommand) {
			this.addStreamCommand(stream);
			this.log.debug(`Added Open Today command for stream ${stream.name}`);
		} else {
			this.log.debug(`Removed Open Today command for stream ${stream.name}`);
		}
	}
	

	private addStreamCommand(stream: Stream) {
		const commandId = `open-${stream.id}`;
		
		// Remove existing command if any
		this.removeStreamCommand(stream.id);

		// Add new command
		const command = this.addCommand({
			id: commandId,
			name: `${stream.name}, today`,
			callback: async () => {
				const command = new OpenTodayStreamCommand(this.app, stream, this.settings.reuseCurrentTab);
				await command.execute();
			}
		});

		this.commandsByStreamId.set(stream.id, commandId);
	}

	public removeStreamCommand(streamId: string) {
		const commandId = this.commandsByStreamId.get(streamId);
		if (commandId) {
			this.removeCommand(commandId);
			this.commandsByStreamId.delete(streamId);
			this.log.debug(`Removed Open Today command for stream ${streamId}`);
		}
	}

	public clearAllStreamCommands(): void {
		this.log.debug('Clearing all stream commands...');
		
		// First, remove all ribbon icons to clear their commands
		this.removeAllRibbonIcons();
		
		// Clear from our tracking map
		const commandIds = Array.from(this.commandsByStreamId.values());
		this.commandsByStreamId.clear();
		
		// Remove explicit commands
		commandIds.forEach(commandId => {
			try {
				this.removeCommand(commandId);
				this.log.debug(`Cleared explicit command: ${commandId}`);
			} catch (error) {
				// Command might not exist, which is fine
			}
		});
		
		// Try to remove ribbon icon commands that might still exist
		this.settings.streams.forEach(stream => {
			const ribbonCommandId = `Streams: ${stream.name}, today`;
			try {
				this.removeCommand(ribbonCommandId);
				this.log.debug(`Cleared ribbon command: ${ribbonCommandId}`);
			} catch (error) {
				// Command might not exist, which is fine
			}
		});
		
		// Force refresh the command palette
		this.forceRefreshCommandPalette();
	}
	
	private forceRefreshCommandPalette(): void {
		// Trigger a command palette refresh by dispatching a custom event
		// This helps ensure the UI updates immediately
		const event = new CustomEvent('streams-commands-cleared');
		document.dispatchEvent(event);
		this.log.debug('Command palette refresh triggered');
	}

	public debugStreamCommands(): void {
		this.log.debug('=== STREAM COMMANDS DEBUG ===');
		this.log.debug(`Commands in tracking map: ${this.commandsByStreamId.size}`);
		this.commandsByStreamId.forEach((commandId, streamId) => {
			this.log.debug(`  ${streamId} -> ${commandId}`);
		});
		
		this.log.debug('Stream settings:');
		this.settings.streams.forEach(stream => {
			this.log.debug(`  ${stream.name}: addCommand=${stream.addCommand}, showTodayInRibbon=${stream.showTodayInRibbon}`);
		});
		
		// Try to find commands in Obsidian's command registry
		const allCommands = (this.app as any).commands?.commands;
		if (allCommands) {
			const streamCommands = Object.keys(allCommands).filter(id => 
				id.includes('stream') || 
				id.includes('Streams:') || 
				id.includes('today') ||
				this.settings.streams.some(s => id.includes(s.name))
			);
			this.log.debug(`Found ${streamCommands.length} potential stream commands in Obsidian:`);
			streamCommands.forEach(cmd => {
				this.log.debug(`  ${cmd}`);
			});
		}
		
		new Notice(`Debug info logged to console. Found ${this.commandsByStreamId.size} tracked commands.`);
	}

	public forcePluginRestart(): void {
		this.log.debug('=== FORCE PLUGIN RESTART ===');
		
		// Clear everything
		this.clearAllStreamCommands();
		
		// Remove all ribbon icons
		this.removeAllRibbonIcons();
		
		// Clear all calendar components
		this.removeAllCalendarComponents();
		
		// Force a complete re-initialization
		setTimeout(() => {
			this.log.debug('Re-initializing everything...');
			this.initializeAllRibbonIcons();
			this.initializeStreamCommands();
			this.initializeActiveView();
			new Notice('Plugin force restarted - check if commands are gone');
		}, 1000);
	}

	private updateIconVisibility(icon: HTMLElement, visible: boolean): void {
		// Use direct style manipulation for immediate effect
		if (visible) {
			icon.style.display = '';
			icon.style.visibility = 'visible';
			icon.classList.remove('streams-plugin-hidden');
			icon.classList.remove('streams-icon-hidden');
		} else {
			icon.style.display = 'none';
			icon.style.visibility = 'hidden';
			icon.classList.add('streams-plugin-hidden');
			icon.classList.add('streams-icon-hidden');
		}
		
		this.log.debug(`Icon visibility updated: ${visible ? 'visible' : 'hidden'}`);
	}

	public initializeStreamCommands(): void {
		this.log.debug('Initializing stream commands...');
		
		// NUCLEAR APPROACH: Clear everything first
		this.clearAllStreamCommands();
		
		// Wait longer to ensure commands are cleared
		setTimeout(() => {
			this.log.debug('Re-registering commands after clear...');
			this.settings.streams.forEach(stream => {
				// Add "Open Today" command if enabled
				if (stream.addCommand) {
					this.addStreamCommand(stream);
					this.log.debug(`Added Open Today command for stream ${stream.name}`);
				} else {
					this.log.debug(`Skipping command for stream ${stream.name} (addCommand: false)`);
				}
			});
		}, 500);
	}


	private registerCalendarCommands(): void {
		this.addCommand({
			id: 'toggle-calendar-component',
			name: 'Toggle calendar component',
			callback: () => {
				this.settings.showCalendarComponent = !this.settings.showCalendarComponent;
				this.saveSettings();
				
				// Immediately refresh all components
				this.refreshAllCalendarComponents();
				
				new Notice(`Calendar component ${this.settings.showCalendarComponent ? 'shown' : 'hidden'}`);
			}
		});
		
		// Add command to open current stream's today note
		this.addCommand({
			id: 'open-current-stream-today',
			name: 'Open Current Stream Today',
			callback: () => {
				const command = new OpenTodayCurrentStreamCommand(this.app, this.settings.streams, this.settings.reuseCurrentTab, this);
				command.execute();
			}
		});
	}

	public refreshAllCalendarComponents(): void {
		// Clean up existing components
		this.calendarComponents.forEach((component) => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
		if (!this.settings.showCalendarComponent) {
			return;
		}
		
		// Recreate components based on current view
		const activeMarkdownLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (activeMarkdownLeaf) {
			this.updateCalendarComponent(activeMarkdownLeaf);
		}
		
		// Try create file view if no markdown component was created
		if (this.calendarComponents.size === 0 && this.app.workspace.activeLeaf) {
			const activeLeaf = this.app.workspace.activeLeaf;
			const viewType = activeLeaf.view?.getViewType();
			
			if (viewType === CREATE_FILE_VIEW_TYPE) {
				this.updateCalendarComponentForCreateView(activeLeaf);
			}
		}
	}
}