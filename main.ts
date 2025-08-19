import { App, MarkdownView, Notice, Plugin, WorkspaceLeaf, Platform, TFile } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings, LucideIcon } from './types';
import { CalendarComponent } from './src/components/CalendarComponent';
import { Logger, LogLevel } from './src/utils/Logger';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from './src/commands/OpenTodayCurrentStreamCommand';
import { StreamSelectionModal } from './src/modals/StreamSelectionModal';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from './src/views/CreateFileView';
import { STREAM_VIEW_TYPE, StreamView } from './src/views/StreamView';
import { ALL_STREAMS_VIEW_TYPE, AllStreamsView } from './src/views/AllStreamsView';
import { OpenStreamViewCommand } from './src/commands/OpenStreamViewCommand';
import { OpenAllStreamsViewCommand } from './src/commands/OpenAllStreamsViewCommand';

const DEFAULT_SETTINGS: StreamsSettings = {
	streams: [],
	showCalendarComponent: true,
	reuseCurrentTab: false,
	calendarCompactState: false,
	activeStreamId: undefined
}

export default class StreamsPlugin extends Plugin {
	settings: StreamsSettings;
	private ribbonIconsByStream: Map<string, {today?: HTMLElement, view?: HTMLElement}> = new Map();
	commandsByStreamId: Map<string, string> = new Map();
	viewCommandsByStreamId: Map<string, string> = new Map();
	private calendarComponents: Map<string, CalendarComponent> = new Map();
	public log: Logger;
	private isInitializing: boolean = true;

	async onload() {
		this.log = new Logger('Streams');
		
		await this.loadSettings();
		
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
		this.registerAllStreamsCommands();

		this.addSettingTab(new StreamsSettingTab(this.app, this));
		this.initializeActiveView();
		this.logInitialState();
		
		// Final refresh to ensure all calendar components are created
		setTimeout(() => {
			this.refreshCalendarComponentsForNewViews();
		}, 500);
		
		// Set up periodic refresh to ensure calendar components stay visible
		this.setupPeriodicRefresh();
		
		// Create global stream indicator
		this.createGlobalStreamIndicator();
		
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
				// Toggle between DEBUG and NONE
				if (this.log.isEnabled()) {
					this.log.off();
					new Notice('Streams logging disabled');
				} else {
					this.log.on(LogLevel.DEBUG);
					new Notice('Streams logging enabled (DEBUG level)');
				}
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

		// Add a command to show calendar component status
		this.addCommand({
			id: 'show-calendar-component-status',
			name: 'Show calendar component status',
			callback: () => {
				const totalComponents = this.calendarComponents.size;
				const openStreamFiles = this.app.workspace.getLeavesOfType('markdown')
					.filter(leaf => {
						const view = leaf.view as MarkdownView;
						return view?.file?.path && this.fileBelongsToStream(view.file.path);
					}).length;
				
				new Notice(`Calendar components: ${totalComponents}/${openStreamFiles} stream files`);
				this.log.debug(`Calendar component status: ${totalComponents}/${openStreamFiles} stream files`);
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
	}
	
	private logInitialState(): void {
		this.settings.streams.forEach(stream => {
			this.log.debug(`Stream ${stream.name}: Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
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
				viewIcon: "list", 
				showTodayInRibbon: false, 
				showFullStreamInRibbon: false, 
				addCommand: false, 
				addViewCommand: false,
				showTodayBorder: true,
				showViewBorder: true,
				todayBorderColor: "var(--text-accent)",
				viewBorderColor: "var(--text-success)"
			}, new Date())
		);
		
		// Register StreamView
		this.registerView(
			STREAM_VIEW_TYPE,
			(leaf) => this.createStreamViewFromState(leaf)
		);
		
		// Register AllStreamsView
		this.registerView(
			ALL_STREAMS_VIEW_TYPE,
			(leaf) => new AllStreamsView(leaf, this.app)
		);
	}
	
	private createStreamViewFromState(leaf: WorkspaceLeaf): StreamView {
		const state = leaf.getViewState();
		const streamId = state?.state?.streamId;
		let stream = this.settings.streams.find(s => s.id === streamId);
		
		// If no stream found in view state, try to use the saved active stream
		if (!stream && this.settings.activeStreamId) {
			stream = this.settings.streams.find(s => s.id === this.settings.activeStreamId);
			this.log.debug(`View state missing streamId, using saved active stream: ${stream?.name || 'Unknown'} (${this.settings.activeStreamId})`);
		}
		
		// Fall back to first stream only if no active stream is saved
		if (!stream && this.settings.streams.length > 0) {
			stream = this.settings.streams[0];
			this.log.debug(`No active stream saved, falling back to first stream: ${stream.name}`);
		} else if (!stream) {
			stream = {
				id: "default",
				name: "Default Stream",
				folder: "",
				icon: "file-text",
				viewIcon: "list",
				showTodayInRibbon: false,
				showFullStreamInRibbon: false,
				addCommand: false,
				addViewCommand: false,
				showTodayBorder: true,
				showViewBorder: true,
				todayBorderColor: "var(--text-accent)",
				viewBorderColor: "var(--text-success)"
			};
			this.log.debug('No streams configured, using default stream');
		}
		
		return new StreamView(leaf, this.app, stream);
	}
	
	private initializeAllRibbonIcons(): void {
		// Create the main All Streams ribbon icon
		this.createAllStreamsIcon();
		
		// Create icons for all streams (even if hidden)
		this.settings.streams.forEach(stream => {
			this.createStreamIcons(stream);
		});
		
		// Update visibility based on settings
		this.updateAllIconVisibility();
	}
	
	private createAllStreamsIcon(): void {
		// Main All Streams dashboard button
		this.addRibbonIcon(
			'layout-dashboard',
			'Streams: View all streams',
			() => {
				const command = new OpenAllStreamsViewCommand(this.app);
				command.execute();
			}
		);
		
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
		
		// Create Today icon if needed
		if (!streamIcons.today) {
			this.log.debug(`Creating Today icon for stream ${stream.id}, initial visibility: ${stream.showTodayInRibbon}`);
			
			streamIcons.today = this.addRibbonIcon(
				stream.icon,
				`Streams: ${stream.name}, today`,
				() => {
					const command = new OpenTodayStreamCommand(this.app, stream, this.settings.reuseCurrentTab);
					command.execute();
				}
			);
			
			// Hide initially, visibility updated later
			this.updateIconVisibility(streamIcons.today, false);
			
			if (stream.showTodayBorder) {
				this.applyTodayIconStyles(streamIcons.today, stream);
			}
		}
		
		// Create View icon if needed
		if (!streamIcons.view) {
			this.log.debug(`Creating View icon for stream ${stream.id}, initial visibility: ${stream.showFullStreamInRibbon}`);
			
			streamIcons.view = this.addRibbonIcon(
				stream.viewIcon || stream.icon,
				`Streams: ${stream.name}, full`,
				() => {
					const command = new OpenStreamViewCommand(this.app, stream);
					command.execute();
				}
			);
			
			// Hide initially, visibility updated later
			this.updateIconVisibility(streamIcons.view, false);
			
			if (stream.showViewBorder) {
				this.applyViewIconStyles(streamIcons.view, stream);
			}
		}
	}
	
	private applyTodayIconStyles(icon: HTMLElement, stream: Stream): void {
		if (!icon) return;
		
		try {
			icon.classList.add('streams-today-icon-border');
			
			if (stream.todayBorderColor && stream.todayBorderColor !== 'default') {
				icon.setAttribute('data-border-color', stream.todayBorderColor);
			}
		} catch (error) {
			this.log.error('Error applying today icon styles:', error);
		}
	}
	
	private applyViewIconStyles(icon: HTMLElement, stream: Stream): void {
		if (!icon) return;
		
		try {
			icon.classList.add('streams-view-icon-border');
			
			if (stream.viewBorderColor && stream.viewBorderColor !== 'default') {
				icon.setAttribute('data-border-color', stream.viewBorderColor);
			}
		} catch (error) {
			this.log.error('Error applying view icon styles:', error);
		}
	}

	private updateAllIconVisibility(): void {
		this.settings.streams.forEach(stream => {
			this.updateStreamIconVisibility(stream);
		});
	}
	
	private updateStreamIconVisibility(stream: Stream): void {
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (streamIcons) {
			if (streamIcons.today) {
				this.updateIconVisibility(streamIcons.today, stream.showTodayInRibbon);
			}
			
			if (streamIcons.view) {
				this.updateIconVisibility(streamIcons.view, stream.showFullStreamInRibbon);
			}
		}
	}
	
	public updateStreamTodayIcon(stream: Stream): void {
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (streamIcons && streamIcons.today) {
			streamIcons.today.classList.toggle('streams-today-icon-border', stream.showTodayBorder);
			
			if (stream.showTodayBorder) {
				this.applyTodayIconStyles(streamIcons.today, stream);
			}
		}
	}
	
	public updateStreamViewIcon(stream: Stream): void {
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (streamIcons && streamIcons.view) {
			streamIcons.view.classList.toggle('streams-view-icon-border', stream.showViewBorder);
			
			if (stream.showViewBorder) {
				this.applyViewIconStyles(streamIcons.view, stream);
			}
		}
	}
	
	private removeAllRibbonIcons(): void {
		this.ribbonIconsByStream.forEach((icons) => {
			if (icons.today) icons.today.detach();
			if (icons.view) icons.view.detach();
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
		
		this.commandsByStreamId.clear();
		this.viewCommandsByStreamId.clear();
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

		// Handle new leaves being created (new tabs opened)
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Small delay to ensure new views are fully initialized
				setTimeout(() => {
					this.refreshCalendarComponentsForNewViews();
				}, 200);
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
		
		// Get all open leaves
		const allLeaves = this.app.workspace.getLeavesOfType('markdown');
		this.log.debug(`Found ${allLeaves.length} open markdown leaves`);
		
		// Initialize calendar components for ALL open stream files
		allLeaves.forEach(leaf => {
			const view = leaf.view as MarkdownView;
			if (view?.file?.path) {
				const filePath = view.file.path;
				// Create component for ALL stream files, regardless of focus
				if (this.fileBelongsToStream(filePath)) {
					if (!this.calendarComponents.has(filePath)) {
						this.log.debug(`Creating calendar component for stream file: ${filePath}`);
						this.updateCalendarComponent(leaf);
					} else {
						this.log.debug(`Calendar component already exists for stream file: ${filePath}`);
					}
				} else {
					this.log.debug(`Skipping non-stream file: ${filePath}`);
				}
			}
		});
		
		this.log.debug(`Initialized ${this.calendarComponents.size} calendar components`);
	}

	public updateCalendarComponent(leaf: WorkspaceLeaf) {
		const view = leaf.view as MarkdownView;
		const filePath = view.file?.path;
		
		this.log.debug(`Updating calendar component for file: ${filePath}`);
		this.log.debug(`Current calendar components: ${this.calendarComponents.size}`);

		// Only clean up components for this specific leaf/file
		const componentId = filePath || crypto.randomUUID();
		const existingComponent = this.calendarComponents.get(componentId);
		if (existingComponent) {
			this.log.debug(`Destroying existing calendar component for: ${componentId}`);
			existingComponent.destroy();
			this.calendarComponents.delete(componentId);
		}

		// Exit early if there's no file path or the calendar is disabled
		if (!filePath || !this.settings.showCalendarComponent) {
			this.log.debug(`Not creating calendar component. File path: ${filePath ? 'exists' : 'missing'}, Component enabled: ${this.settings.showCalendarComponent}`);
			return;
		}

		this.log.debug(`Looking for stream matching file: ${filePath}`);
		this.log.debug('Available streams:', this.settings.streams.map(s => ({
			name: s.name,
			folder: s.folder
		})));

		// Find which stream this file belongs to
		const stream = this.getStreamForFile(filePath);

		if (stream) {
			this.log.debug(`File belongs to stream: ${stream.name} (${stream.folder})`);
			const component = new CalendarComponent(leaf, stream, this.app, this.settings.reuseCurrentTab, this.settings.streams, this);
			this.calendarComponents.set(componentId, component);
			
			// Don't automatically set active stream from calendar component updates
			// Active stream should only be set by explicit user actions
			this.log.debug(`Calendar component created successfully for: ${componentId}`);
		} else {
			this.log.debug('File does not belong to any stream');
		}
		
		this.log.debug(`Calendar components after update: ${this.calendarComponents.size}`);
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
			const componentId = 'create-file-view-' + stream.id;
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
			
			const componentId = 'create-file-view-' + stream.id;
			this.calendarComponents.set(componentId, component);
			
			this.log.debug('Calendar component for create file view created successfully');
		} catch (error) {
			this.log.error('Error setting up calendar component for create view:', error);
		}
	}

	public addStreamViewCommand(stream: Stream) {
		const streamId = stream.id;
		
		// Skip if command already exists
		if (this.viewCommandsByStreamId.has(streamId)) {
			return;
		}
		
		const commandId = `view-${streamId}`;
		this.addCommand({
			id: commandId,
			name: `Open full view: ${stream.name}`,
			callback: () => {
				const command = new OpenStreamViewCommand(this.app, stream);
				command.execute();
			}
		});

		this.viewCommandsByStreamId.set(streamId, commandId);
	}

	public removeStreamViewCommand(streamId: string) {
		const commandId = this.viewCommandsByStreamId.get(streamId);
		if (commandId) {
			this.removeCommand(commandId);
			this.viewCommandsByStreamId.delete(streamId);
			this.log.debug(`Removed View Full Stream command for stream ${streamId}`);
		}
	}

	public updateAllCalendarComponents() {
		this.calendarComponents.forEach(component => {
			component.updateStreamsList(this.settings.streams);
		});
	}

	public forceRefreshAllCalendarComponents() {
		this.log.debug('Force refreshing all calendar components');
		
		// Clear all existing components
		this.calendarComponents.forEach(component => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
		// Recreate components for all open stream files
		this.refreshCalendarComponentsForNewViews();
		
		this.log.debug(`Force refresh complete. Total components: ${this.calendarComponents.size}`);
	}

	public refreshCalendarComponentsForNewViews() {
		this.log.debug('Refreshing calendar components for all views');
		
		// Get all current markdown leaves
		const allLeaves = this.app.workspace.getLeavesOfType('markdown');
		
		// Ensure ALL stream files have calendar components
		allLeaves.forEach(leaf => {
			const view = leaf.view as MarkdownView;
			if (view?.file?.path) {
				const filePath = view.file.path;
				// Create component for ALL stream files, regardless of focus
				if (this.fileBelongsToStream(filePath)) {
					if (!this.calendarComponents.has(filePath)) {
						this.log.debug(`Creating missing calendar component for stream file: ${filePath}`);
						this.updateCalendarComponent(leaf);
					} else {
						this.log.debug(`Calendar component already exists for stream file: ${filePath}`);
					}
				}
			}
		});
		
		this.log.debug(`Total calendar components after refresh: ${this.calendarComponents.size}`);
	}

	public ensureCalendarComponentForFile(filePath: string) {
		this.log.debug(`Ensuring calendar component exists for file: ${filePath}`);
		
		// Find the leaf that contains this file
		const leaf = this.app.workspace.getLeavesOfType('markdown').find(leaf => {
			const view = leaf.view as MarkdownView;
			return view?.file?.path === filePath;
		});
		
		if (leaf && !this.calendarComponents.has(filePath)) {
			this.log.debug(`Creating missing calendar component for file: ${filePath}`);
			this.updateCalendarComponent(leaf);
		} else if (this.calendarComponents.has(filePath)) {
			this.log.debug(`Calendar component already exists for file: ${filePath}`);
		} else {
			this.log.debug(`No leaf found for file: ${filePath}`);
		}
	}

	private fileBelongsToStream(filePath: string): boolean {
		if (!filePath) return false;
		
		const result = this.settings.streams.some(stream => {
			// Skip streams with empty folders
			if (!stream.folder || stream.folder.trim() === '') {
				return false;
			}
			
			// Normalize paths for comparison
			const normalizedFilePath = filePath.split(/[/\\]/).filter(Boolean);
			const normalizedStreamPath = stream.folder.split(/[/\\]/).filter(Boolean);
			
			// If stream path is empty, skip this stream
			if (normalizedStreamPath.length === 0) {
				return false;
			}
			
			// Check if the file path starts with the stream path
			return normalizedStreamPath.every((part, index) => {
				// Check bounds
				if (index >= normalizedFilePath.length) {
					return false;
				}
				return normalizedStreamPath[index] === normalizedFilePath[index];
			});
		});
		
		if (result) {
			this.log.debug(`File ${filePath} belongs to a stream`);
		}
		
		return result;
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

	private setupPeriodicRefresh(): void {
		// Refresh calendar components every 2 seconds to ensure they stay visible
		setInterval(() => {
			if (!this.isInitializing) {
				this.refreshCalendarComponentsForNewViews();
				// Also ensure global stream indicator exists
				this.ensureGlobalStreamIndicator();
			}
		}, 2000);
		
		this.log.debug('Periodic calendar component refresh enabled (every 2 seconds)');
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
			const newStream = this.settings.streams.find(s => s.id === streamId);
			const previousStream = previousStreamId ? this.settings.streams.find(s => s.id === previousStreamId) : null;
			this.log.debug(`Active stream changed: ${previousStream?.name || 'None'} → ${newStream?.name || 'Unknown'}`);
			
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
		
		// Migrate existing streams
		this.settings.streams.forEach(stream => {
			this.migrateStreamSettings(stream);
		});
	}
	
	private migrateStreamSettings(stream: Stream): void {
		// Add viewIcon if missing
		if (!stream.viewIcon) {
			stream.viewIcon = stream.icon;
		}
		
		// Migrate from old property names
		const streamAny = stream as any; // Temporary for migration
		if (streamAny.showInRibbon !== undefined && stream.showTodayInRibbon === undefined) {
			stream.showTodayInRibbon = streamAny.showInRibbon;
			delete streamAny.showInRibbon;
		}
		
		if (streamAny.showViewInRibbon !== undefined && stream.showFullStreamInRibbon === undefined) {
			stream.showFullStreamInRibbon = streamAny.showViewInRibbon;
			delete streamAny.showViewInRibbon;
		}
		
		// Set default values if undefined
		if (stream.showTodayInRibbon === undefined) {
			stream.showTodayInRibbon = false;
		}
		
		if (stream.showFullStreamInRibbon === undefined) {
			stream.showFullStreamInRibbon = false;
		}

		if (stream.showTodayBorder === undefined) {
			stream.showTodayBorder = true;
		}
		
		if (stream.showViewBorder === undefined) {
			stream.showViewBorder = true;
		}
		
		if (stream.todayBorderColor === undefined) {
			stream.todayBorderColor = 'var(--text-accent)';
		}
		
		if (stream.viewBorderColor === undefined) {
			stream.viewBorderColor = 'var(--text-success)';
		}
	}

	async saveSettings(refreshUI: boolean = false) {
		try {
			await this.saveData(this.settings);
			this.log.debug("Settings saved");
			
			this.logSavedSettings();
			this.updateAllIconVisibility();
		} catch (error) {
			this.log.error("Error saving settings:", error);
		}
	}
	
	private logSavedSettings(): void {
		this.settings.streams.forEach(stream => {
			this.log.debug(`Stream ${stream.name}: Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
		});
	}

	
	public toggleStreamCommand(stream: Stream) {
		// Remove existing command first
		this.removeStreamCommand(stream.id);
		
		// Add if enabled
		if (stream.addCommand) {
			this.addStreamCommand(stream);
		}
		
		this.log.debug(`Toggled Open Today command for stream ${stream.id} to ${stream.addCommand}`);
	}
	
	public toggleStreamViewCommand(stream: Stream) {
		// Remove existing view command first
		this.removeStreamViewCommand(stream.id);
		
		// Add if enabled
		if (stream.addViewCommand) {
			this.addStreamViewCommand(stream);
		}
		
		this.log.debug(`Toggled View Full Stream command for stream ${stream.id} to ${stream.addViewCommand}`);
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

	private updateIconVisibility(icon: HTMLElement, visible: boolean): void {
		const wasVisible = !icon.classList.contains('streams-icon-hidden') && !icon.classList.contains('streams-plugin-hidden');
		
		// Get stream info for styling
		const streamId = icon.getAttribute('data-stream-id');
		const iconType = icon.getAttribute('data-icon-type');
		
		if (visible) {
			icon.classList.remove('streams-plugin-hidden');
			icon.classList.remove('streams-icon-hidden');
			icon.classList.add('streams-icon-visible');
			
			// Add to DOM if needed
			if (!document.body.contains(icon)) {
				const ribbon = this.app.workspace.containerEl.querySelector(".side-dock-ribbon");
				if (ribbon) {
					ribbon.appendChild(icon);
				}
			}
			
			// Reapply styling
			if (streamId) {
				const stream = this.settings.streams.find(s => s.id === streamId);
				if (stream) {
					if (iconType === 'today') {
						this.applyTodayIconStyles(icon, stream);
					} else if (iconType === 'view') {
						this.applyViewIconStyles(icon, stream);
					}
				}
			}
		} else {
			icon.classList.add('streams-icon-hidden');
			icon.classList.add('streams-plugin-hidden');
		}
		
		const isNowVisible = !icon.classList.contains('streams-icon-hidden') && !icon.classList.contains('streams-plugin-hidden');
		this.log.debug(`Icon visibility update: ${wasVisible ? 'visible' : 'hidden'} → ${isNowVisible ? 'visible' : 'hidden'}`);
	}

	public initializeStreamCommands(): void {
		this.log.debug('Initializing stream commands...');
		
		this.settings.streams.forEach(stream => {
			// Add "Open Today" command if enabled
			if (stream.addCommand) {
				this.addStreamCommand(stream);
				this.log.debug(`Added Open Today command for stream ${stream.name}`);
			}
			
			// Add "View Full Stream" command if enabled
			if (stream.addViewCommand) {
				this.addStreamViewCommand(stream);
				this.log.debug(`Added View Full Stream command for stream ${stream.name}`);
			}
		});
	}

	private registerAllStreamsCommands(): void {
		this.addCommand({
			id: 'open-all-streams-view',
			name: 'Open All Streams View',
			callback: () => {
				const command = new OpenAllStreamsViewCommand(this.app);
				command.execute();
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
		
		this.addCommand({
			id: 'toggle-calendar-compact',
			name: 'Toggle calendar compact mode',
			callback: () => {
				this.settings.calendarCompactState = !this.settings.calendarCompactState;
				this.saveSettings();
				
				// Immediately refresh all components to apply the new compact state
				this.refreshAllCalendarComponents();
				
				new Notice(`Calendar compact mode ${this.settings.calendarCompactState ? 'enabled' : 'disabled'}`);
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