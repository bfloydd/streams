import { App, MarkdownView, Notice, Plugin, WorkspaceLeaf, Platform, TFile } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings, LucideIcon } from './types';
import { CalendarComponent } from './src/components/CalendarComponent';
import { Logger, LogLevel } from './src/utils/Logger';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';
import { StreamSelectionModal } from './src/modals/StreamSelectionModal';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from './src/views/CreateFileView';
import { STREAM_VIEW_TYPE, StreamView } from './src/views/StreamView';
import { OpenStreamViewCommand } from './src/commands/OpenStreamViewCommand';

const DEFAULT_SETTINGS: StreamsSettings = {
	streams: [],
	showCalendarComponent: true,
	reuseCurrentTab: false
}

export default class StreamsPlugin extends Plugin {
	settings: StreamsSettings;
	private ribbonIconsByStream: Map<string, {today?: HTMLElement, view?: HTMLElement}> = new Map();
	commandsByStreamId: Map<string, string> = new Map();
	viewCommandsByStreamId: Map<string, string> = new Map();
	calendarComponents: Map<string, CalendarComponent> = new Map();
	public log: Logger;

	async onload() {
		this.log = new Logger('Streams');
		
		await this.loadSettings();
		
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
	}
	
	private logInitialState(): void {
		this.log.debug("=== INITIAL STREAM RIBBON STATES ===");
		this.settings.streams.forEach(stream => {
			this.log.debug(`Stream ${stream.id} (${stream.name}): Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
		});
		this.log.debug("===================================");
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
	}
	
	private createStreamViewFromState(leaf: WorkspaceLeaf): StreamView {
		const state = leaf.getViewState();
		const streamId = state?.state?.streamId;
		let stream = this.settings.streams.find(s => s.id === streamId);
		
		// Fall back to first stream or create dummy if none exists
		if (!stream && this.settings.streams.length > 0) {
			stream = this.settings.streams[0];
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
		}
		
		return new StreamView(leaf, this.app, stream);
	}
	
	private initializeAllRibbonIcons(): void {
		// Create icons for all streams (even if hidden)
		this.settings.streams.forEach(stream => {
			this.createStreamIcons(stream);
		});
		
		// Update visibility based on settings
		this.updateAllIconVisibility();
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
		this.log.info('Unloading Streams plugin');
		this.cleanupResources();
		this.log.info('Streams plugin unloaded');
	}

	private cleanupResources(): void {
		this.removeAllRibbonIcons();
		
		this.calendarComponents.forEach(component => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
		this.commandsByStreamId.clear();
		this.viewCommandsByStreamId.clear();
	}
	
	private registerEventHandlers(): void {
		// Handle active leaf changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				this.log.debug('Active leaf changed');
				if (leaf?.view instanceof MarkdownView) {
					this.updateCalendarComponent(leaf);
				} else if (leaf?.view.getViewType() === CREATE_FILE_VIEW_TYPE) {
					this.updateCalendarComponentForCreateView(leaf);
				}
			})
		);

		// Update calendar when create file state changes
		this.registerEvent(
			// @ts-ignore - Custom event not in type definitions
			this.app.workspace.on('streams-create-file-state-changed', (view: any) => {
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
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (activeLeaf) {
			this.updateCalendarComponent(activeLeaf);
		}
	}

	public updateCalendarComponent(leaf: WorkspaceLeaf) {
		const view = leaf.view as MarkdownView;
		const filePath = view.file?.path;
		
		this.log.debug('Updating calendar component for file:', filePath);

		// Clean up existing components
		this.calendarComponents.forEach((component) => {
			component.destroy();
		});
		this.calendarComponents.clear();

		// Exit early if there's no file path or the calendar is disabled
		if (!filePath || !this.settings.showCalendarComponent) {
			this.log.debug(`Not creating calendar component. File path: ${filePath ? 'exists' : 'missing'}, Component enabled: ${this.settings.showCalendarComponent}`);
			return;
		}

		// Log streams for debugging
		this.log.debug(`Looking for stream matching file: ${filePath}`);
		this.log.debug('Available streams:', this.settings.streams.map(s => ({
			name: s.name,
			folder: s.folder
		})));

		// Find which stream this file belongs to
		const stream = this.settings.streams.find(s => {
			// Skip streams with empty folders
			if (!s.folder || s.folder.trim() === '') {
				return false;
			}
			
			// Normalize paths for comparison
			const normalizedFilePath = filePath.split(/[/\\]/).filter(Boolean);
			const normalizedStreamPath = s.folder.split(/[/\\]/).filter(Boolean);
			
			// If stream path is empty, skip this stream
			if (normalizedStreamPath.length === 0) {
				return false;
			}
			
			// Check if the file path starts with the stream path
			const isInStreamFolder = normalizedStreamPath.every((part, index) => {
				// Check bounds
				if (index >= normalizedFilePath.length) {
					return false;
				}
				return normalizedStreamPath[index] === normalizedFilePath[index];
			});
			
			this.log.debug(`Checking stream "${s.name}" (${s.folder}):`, {
				isInStreamFolder,
				normalizedFilePath,
				normalizedStreamPath
			});
			
			return isInStreamFolder;
		});

		if (stream) {
			this.log.debug(`File belongs to stream: ${stream.name} (${stream.folder})`);
			const component = new CalendarComponent(leaf, stream, this.app, this.settings.reuseCurrentTab, this.settings.streams);
			const componentId = filePath || crypto.randomUUID();
			this.calendarComponents.set(componentId, component);
			this.log.debug('Calendar component created successfully');
		} else {
			this.log.debug('File does not belong to any stream');
		}
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
		
		// Clean up existing components
		this.calendarComponents.forEach((component) => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
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
			const component = new CalendarComponent(leaf, stream, this.app, this.settings.reuseCurrentTab, this.settings.streams);
			
			// Set current viewed date
			const formattedDate = dateString.split('T')[0];
			component.setCurrentViewedDate(formattedDate);
			
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// Ensure showCalendarComponent has a default value if not set
		if (this.settings.showCalendarComponent === undefined) {
			this.settings.showCalendarComponent = true;
		}
		
		// Ensure reuseCurrentTab has a default value if not set
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
		// @ts-ignore - Accessing old property names for migration
		if (stream['showInRibbon'] !== undefined && stream.showTodayInRibbon === undefined) {
			// @ts-ignore - Accessing old property names for migration
			stream.showTodayInRibbon = stream['showInRibbon'];
			// @ts-ignore - Accessing old property names for migration
			delete stream['showInRibbon'];
		}
		
		// @ts-ignore - Accessing old property names for migration
		if (stream['showViewInRibbon'] !== undefined && stream.showFullStreamInRibbon === undefined) {
			// @ts-ignore - Accessing old property names for migration
			stream.showFullStreamInRibbon = stream['showViewInRibbon'];
			// @ts-ignore - Accessing old property names for migration
			delete stream['showViewInRibbon'];
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
		this.log.debug("Saving settings...");
		try {
			await this.saveData(this.settings);
			this.log.debug("Settings saved successfully");
			
			this.logSavedSettings();
			this.updateAllIconVisibility();
		} catch (error) {
			this.log.error("Error saving settings:", error);
		}
	}
	
	private logSavedSettings(): void {
		this.log.debug("=== SAVED STREAM STATES ===");
		this.settings.streams.forEach(stream => {
			this.log.debug(`Stream ${stream.id} (${stream.name}): Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
		});
		this.log.debug("==========================");
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
		// Log visibility state
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
	}

	public refreshAllCalendarComponents(): void {
		// Always clean up existing components first
		this.log.debug(`Refreshing all calendar components. Current setting: ${this.settings.showCalendarComponent}`);
		this.calendarComponents.forEach((component) => {
			component.destroy();
		});
		this.calendarComponents.clear();
		
		// If components should be hidden, we're done
		if (!this.settings.showCalendarComponent) {
			this.log.debug('Calendar components will remain hidden due to setting');
			return;
		}
		
		// Track if we successfully created at least one component
		let componentCreated = false;
		
		// Otherwise, force recreation based on the current view type
		this.log.debug('Recreating calendar components based on current view');
		
		// Handle markdown view case - most common
		const activeMarkdownLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (activeMarkdownLeaf) {
			this.log.debug('Active view is a markdown view, creating component if applicable');
			this.updateCalendarComponent(activeMarkdownLeaf);
			
			// Check if a component was actually created
			if (this.calendarComponents.size > 0) {
				componentCreated = true;
				this.log.debug('Calendar component successfully created for markdown view');
			}
		}
		
		// If no component was created and there's an active leaf, try other view types
		if (!componentCreated && this.app.workspace.activeLeaf) {
			const activeLeaf = this.app.workspace.activeLeaf;
			const viewType = activeLeaf.view?.getViewType();
			
			// Handle create file view case
			if (viewType === CREATE_FILE_VIEW_TYPE) {
				this.log.debug('Active view is a create file view, creating component');
				this.updateCalendarComponentForCreateView(activeLeaf);
				componentCreated = this.calendarComponents.size > 0;
			} 
			// Stream views and other view types don't get calendar components
		}
		
		if (!componentCreated) {
			this.log.debug('No calendar component was created during refresh. This may be because no suitable view is active or the current file is not part of a stream.');
		}
	}
}