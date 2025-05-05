import { App, MarkdownView, Notice, Plugin, WorkspaceLeaf, Platform, TFile } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings } from './types';
import { CalendarWidget } from './src/components/CalendarWidget';
import { Logger } from './src/utils/Logger';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';
import { StreamSelectionModal } from './src/modals/StreamSelectionModal';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from './src/components/CreateFileView';
import { STREAM_VIEW_TYPE, StreamViewWidget } from './src/components/StreamViewWidget';
import { OpenStreamViewCommand } from './src/commands/OpenStreamViewCommand';

// Lucide icon names used by the plugin
type LucideIcon =
	| 'alarm-check'
	| 'album'
	| 'alert-circle'
	| 'archive'
	| 'book'
	| 'bookmark'
	| 'box'
	| 'calendar'
	| 'check-circle'
	| 'clipboard'
	| 'clock'
	| 'cloud'
	| 'code'
	| 'coffee'
	| 'edit'
	| 'file-text'
	| 'folder'
	| 'heart'
	| 'home'
	| 'inbox'
	| 'layout-dashboard'
	| 'list'
	| 'message-circle'
	| 'music'
	| 'pencil'
	| 'settings'
	| 'star'
	| 'sun'
	| 'tag'
	| 'trash'
	| 'user'

export function isValidIcon(icon: string): icon is LucideIcon {
	return document.querySelector(`[data-icon="${icon}"]`) !== null;
}

const DEFAULT_SETTINGS: StreamsSettings = {
	streams: [],
	showCalendarWidget: true
}

export default class StreamsPlugin extends Plugin {
	settings: StreamsSettings;
	private ribbonIconsByStream: Map<string, {today?: HTMLElement, view?: HTMLElement}> = new Map();
	commandsByStreamId: Map<string, string> = new Map();
	viewCommandsByStreamId: Map<string, string> = new Map();
	calendarWidgets: Map<string, CalendarWidget> = new Map();
	public log: Logger = new Logger();

	async onload() {
		await this.loadSettings();
		this.log = new Logger();
		
		this.registerPluginViews();
		this.registerEventHandlers();
		this.initializeAllRibbonIcons();
		this.initializeStreamCommands();
		this.initializeMobileIntegration();
		this.registerCalendarCommands();

		this.addSettingTab(new StreamsSettingTab(this.app, this));
		this.initializeActiveView();
		this.logInitialState();

		// Style element for dynamic styles
		const styleEl = document.createElement('style');
		styleEl.id = 'streams-calendar-styles';
		document.head.appendChild(styleEl);

		// Load CSS styles from styles.css
		await this.loadStyles();

		this.log.info('Streams plugin loaded');
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
		
		// Register StreamViewWidget
		this.registerView(
			STREAM_VIEW_TYPE,
			(leaf) => this.createStreamViewFromState(leaf)
		);
	}
	
	private createStreamViewFromState(leaf: WorkspaceLeaf): StreamViewWidget {
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
		
		return new StreamViewWidget(leaf, this.app, stream);
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
				`Streams: ${stream.name}, Today`,
				() => {
					const command = new OpenTodayStreamCommand(this.app, stream);
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
				`Streams: ${stream.name}, Full`,
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
				icon.style.setProperty('--stream-today-border-color', stream.todayBorderColor);
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
				icon.style.setProperty('--stream-view-border-color', stream.viewBorderColor);
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
		
		this.calendarWidgets.forEach(widget => {
			widget.destroy();
		});
		this.calendarWidgets.clear();
		
		this.commandsByStreamId.clear();
		this.viewCommandsByStreamId.clear();
	}
	
	private registerEventHandlers(): void {
		// Handle active leaf changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				this.log.debug('Active leaf changed');
				if (leaf?.view instanceof MarkdownView) {
					this.updateCalendarWidget(leaf);
				} else if (leaf?.view.getViewType() === CREATE_FILE_VIEW_TYPE) {
					this.updateCalendarWidgetForCreateView(leaf);
				}
			})
		);

		// Update calendar when create file state changes
		this.registerEvent(
			// @ts-ignore - Custom event not in type definitions
			this.app.workspace.on('streams-create-file-state-changed', (view: any) => {
				this.log.debug('Create file state changed, updating calendar widget');
				if (view && view.leaf) {
					this.updateCalendarWidgetForCreateView(view.leaf);
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
			this.updateCalendarWidget(activeLeaf);
		}
	}

	public updateCalendarWidget(leaf: WorkspaceLeaf) {
		const view = leaf.view as MarkdownView;
		const filePath = view.file?.path;
		
		this.log.debug('Updating calendar widget for file:', filePath);

		// Clean up existing widgets
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();

		// Exit early if there's no file path or the calendar is disabled
		if (!filePath || !this.settings.showCalendarWidget) {
			this.log.debug(`Not creating calendar widget. File path: ${filePath ? 'exists' : 'missing'}, Widget enabled: ${this.settings.showCalendarWidget}`);
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
			const widget = new CalendarWidget(leaf, stream, this.app);
			const widgetId = filePath || crypto.randomUUID();
			this.calendarWidgets.set(widgetId, widget);
			this.log.debug('Calendar widget created successfully');
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
				const content = await this.app.vault.read(file);
				const newContent = content + (content.length > 0 ? '\n' : '') + link;
				await this.app.vault.modify(file, newContent);

				new Notice(`Added link to ${stream.name}`);
			}
		} catch (error) {
			this.log.error('Error inserting link:', error);
			new Notice('Failed to insert link into stream');
		}
	}

	public updateCalendarWidgetForCreateView(leaf: WorkspaceLeaf) {
		const view = leaf.view;
		if (!view) {
			this.log.debug('Cannot update calendar widget: no view found');
			return;
		}
		
		// Clean up existing widgets
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();
		
		if (!this.settings.showCalendarWidget) {
			this.log.debug('Calendar widget is disabled in settings');
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
			
			this.log.debug('Creating calendar widget for create file view:', {
				stream: stream.name,
				date: date.toISOString()
			});
			
			// Create the calendar widget
			const widget = new CalendarWidget(leaf, stream, this.app);
			
			// Set current viewed date
			const formattedDate = dateString.split('T')[0];
			widget.setCurrentViewedDate(formattedDate);
			
			const widgetId = 'create-file-view-' + stream.id;
			this.calendarWidgets.set(widgetId, widget);
			
			this.log.debug('Calendar widget for create file view created successfully');
		} catch (error) {
			this.log.error('Error setting up calendar widget for create view:', error);
		}
	}

	public addStreamViewCommand(stream: Stream) {
		const streamId = stream.id;
		
		// Skip if command already exists
		if (this.viewCommandsByStreamId.has(streamId)) {
			return;
		}
		
		const commandId = `streams-view-stream-${streamId}`;
		this.addCommand({
			id: commandId,
			name: `Open Full View: ${stream.name}`,
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

	public forceRebuildAllIcons(): void {
		this.log.debug("=== FORCE REBUILDING ALL RIBBON ICONS ===");
		
		// Ensure all icons are created
		this.settings.streams.forEach(stream => {
			this.createStreamIcons(stream);
		});
		
		// Update visibility
		this.updateAllIconVisibility();
		
		this.log.debug("=== FORCE REBUILD COMPLETE ===");
	}

	public directlyToggleSpecificRibbonIcon(type: 'today' | 'view', stream: Stream, enabled: boolean): void {
		this.log.debug(`Directly toggling ${type} icon for ${stream.id} to ${enabled}`);
		
		// Create icons if needed
		this.createStreamIcons(stream);
		
		// Update visibility
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (!streamIcons) return;
		
		if (type === 'today' && streamIcons.today) {
			this.updateIconVisibility(streamIcons.today, enabled);
		} else if (type === 'view' && streamIcons.view) {
			this.updateIconVisibility(streamIcons.view, enabled);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// Ensure showCalendarWidget has a default value if not set
		if (this.settings.showCalendarWidget === undefined) {
			this.settings.showCalendarWidget = true;
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
	
	private loadStyles(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.log.debug("Loading styles from styles.css");
				this.app.vault.adapter.readBinary(
					`${this.app.vault.configDir}/plugins/streams/styles.css`
				).then(data => {
					// Convert ArrayBuffer to string
					const decoder = new TextDecoder('utf-8');
					const cssContent = decoder.decode(data);
					
					// Add styles
					const styleEl = document.createElement('style');
					styleEl.textContent = cssContent;
					document.head.appendChild(styleEl);
					resolve();
				}).catch(error => {
					this.log.error("Error reading styles.css:", error);
					reject(error);
				});
			} catch (error) {
				this.log.error("Error loading styles:", error);
				reject(error);
			}
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
		const commandId = `streams-plugin:open-${stream.id}`;
		
		// Remove existing command if any
		this.removeStreamCommand(stream.id);

		// Add new command
		const command = this.addCommand({
			id: commandId,
			name: `${stream.name}, Today`,
			callback: async () => {
				const command = new OpenTodayStreamCommand(this.app, stream);
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
		const wasVisible = icon.style.display !== 'none' && !icon.classList.contains('is-hidden');
		
		// Get stream info for styling
		const streamId = icon.getAttribute('data-stream-id');
		const iconType = icon.getAttribute('data-icon-type');
		
		if (visible) {
			icon.classList.remove('is-hidden');
			icon.style.display = 'flex';
			
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
			icon.style.display = 'none';
			icon.classList.add('is-hidden');
		}
		
		const isNowVisible = icon.style.display !== 'none' && !icon.classList.contains('is-hidden');
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
			id: 'toggle-calendar-widget',
			name: 'Toggle Calendar Widget',
			callback: () => {
				this.settings.showCalendarWidget = !this.settings.showCalendarWidget;
				this.saveSettings();
				
				// Immediately refresh all widgets
				this.refreshAllCalendarWidgets();
				
				new Notice(`Calendar widget ${this.settings.showCalendarWidget ? 'shown' : 'hidden'}`);
			}
		});
	}

	public refreshAllCalendarWidgets(): void {
		// Always clean up existing widgets first
		this.log.debug(`Refreshing all calendar widgets. Current setting: ${this.settings.showCalendarWidget}`);
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();
		
		// If widgets should be hidden, we're done
		if (!this.settings.showCalendarWidget) {
			this.log.debug('Calendar widgets will remain hidden due to setting');
			return;
		}
		
		// Track if we successfully created at least one widget
		let widgetCreated = false;
		
		// Otherwise, force recreation based on the current view type
		this.log.debug('Recreating calendar widgets based on current view');
		
		// Handle markdown view case - most common
		const activeMarkdownLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (activeMarkdownLeaf) {
			this.log.debug('Active view is a markdown view, creating calendar if applicable');
			this.updateCalendarWidget(activeMarkdownLeaf);
			
			// Check if a widget was actually created
			if (this.calendarWidgets.size > 0) {
				widgetCreated = true;
				this.log.debug('Calendar widget successfully created for markdown view');
			}
		}
		
		// If no widget was created and there's an active leaf, try other view types
		if (!widgetCreated && this.app.workspace.activeLeaf) {
			const activeLeaf = this.app.workspace.activeLeaf;
			const viewType = activeLeaf.view?.getViewType();
			
			// Handle create file view case
			if (viewType === CREATE_FILE_VIEW_TYPE) {
				this.log.debug('Active view is a create file view, creating calendar');
				this.updateCalendarWidgetForCreateView(activeLeaf);
				widgetCreated = this.calendarWidgets.size > 0;
			} 
			// Stream views and other view types don't get calendar widgets
		}
		
		if (!widgetCreated) {
			this.log.debug('No calendar widget was created during refresh. This may be because no suitable view is active or the current file is not part of a stream.');
		}
	}
}