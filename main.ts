import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, Platform, Menu, TFile, setIcon } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings } from './types';
import { createDailyNote, openStreamDate } from './src/utils/streamUtils';
import { CalendarWidget } from './src/Widgets/CalendarWidget';
import { normalize } from 'path';
import { Logger } from './src/utils/Logger';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';
import { StreamSelectionModal } from './src/modals/StreamSelectionModal';
import { CREATE_FILE_VIEW_TYPE, CreateFileView } from './src/Widgets/CreateFileView';
import { STREAM_VIEW_TYPE, StreamViewWidget } from './src/Widgets/StreamViewWidget';
import { OpenStreamViewCommand } from './src/commands/OpenStreamViewCommand';

// Add this type for Lucide icon names
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
	// Add more icons as needed from https://lucide.dev

export function isValidIcon(icon: string): icon is LucideIcon {
	return document.querySelector(`[data-icon="${icon}"]`) !== null;
}

const DEFAULT_SETTINGS: StreamsSettings = {
	streams: []
}

export default class StreamsPlugin extends Plugin {
	settings: StreamsSettings;
	// Store icons by stream ID and type
	private ribbonIconsByStream: Map<string, {today?: HTMLElement, view?: HTMLElement}> = new Map();
	commandsByStreamId: Map<string, string> = new Map();
	viewCommandsByStreamId: Map<string, string> = new Map();
	calendarWidgets: Map<string, CalendarWidget> = new Map();
	private log: Logger = new Logger();

	async onload() {
		this.log.info('Loading Streams plugin...');
		
		// Load settings and styles
		await this.loadSettings();
		this.loadStyles();
		
		// Register plugin components
		this.registerPluginViews();
		
		// Initialize ribbon icons based on settings
		this.initializeAllRibbonIcons();
		
		// Initialize commands for streams that have them enabled
		this.initializeStreamCommands();
		
		// Log the current state of all streams for debugging
		this.logInitialState();
		
		// Add settings tab
		this.addSettingTab(new StreamsSettingTab(this.app, this));
		
		// Register remaining components
		this.registerEventHandlers();
		this.initializeMobileIntegration();
		this.initializeActiveView();
		
		this.log.info('Streams plugin loaded successfully');
	}
	
	/**
	 * Log the initial state of all streams for debugging
	 */
	private logInitialState(): void {
		console.log("=== INITIAL STREAM RIBBON STATES ===");
		this.settings.streams.forEach(stream => {
			console.log(`Stream ${stream.id} (${stream.name}): Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
		});
		console.log("===================================");
	}
	
	/**
	 * Register all plugin views
	 */
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
	
	/**
	 * Create a stream view from a leaf's state
	 */
	private createStreamViewFromState(leaf: WorkspaceLeaf): StreamViewWidget {
		const state = leaf.getViewState();
		const streamId = state?.state?.streamId;
		let stream = this.settings.streams.find(s => s.id === streamId);
		
		// Fallback to first stream if none found
		if (!stream && this.settings.streams.length > 0) {
			stream = this.settings.streams[0];
		} else if (!stream) {
			// Create a dummy stream if none exist
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
	
	/**
	 * Initialize all icons for all streams
	 * Creates the icons in hidden state, then shows if enabled
	 */
	private initializeAllRibbonIcons(): void {
		// First, make sure all streams have their icons created (even if hidden)
		this.settings.streams.forEach(stream => {
			this.createStreamIcons(stream);
		});
		
		// Then update visibility based on settings
		this.updateAllIconVisibility();
	}
	
	/**
	 * Create ribbon icons for a stream (but don't show them yet)
	 */
	private createStreamIcons(stream: Stream): void {
		// Get or create entry for this stream
		let streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (!streamIcons) {
			streamIcons = {};
			this.ribbonIconsByStream.set(stream.id, streamIcons);
		}
		
		// Create Today icon if not already created
		if (!streamIcons.today) {
			console.log(`Creating Today icon for stream ${stream.id}, initial visibility: ${stream.showTodayInRibbon}`);
			
			streamIcons.today = this.addRibbonIcon(
				stream.icon,
				`Streams: ${stream.name}, Today`,
				() => {
					const command = new OpenTodayStreamCommand(this.app, stream);
					command.execute();
				}
			);
			
			// Add attributes and styling
			streamIcons.today.setAttribute('data-stream-id', stream.id);
			streamIcons.today.setAttribute('data-icon-type', 'today');
			streamIcons.today.addClass('stream-today-icon');
			
			// Apply custom border styling based on stream settings
			this.applyTodayIconStyles(streamIcons.today, stream);
			
			// Set initial visibility based on settings
			this.updateIconVisibility(streamIcons.today, stream.showTodayInRibbon);
		}
		
		// Create View icon if not already created
		if (!streamIcons.view) {
			console.log(`Creating View icon for stream ${stream.id}, initial visibility: ${stream.showFullStreamInRibbon}`);
			
			streamIcons.view = this.addRibbonIcon(
				stream.viewIcon || stream.icon,
				`Streams: ${stream.name}, Full`,
				() => {
					const command = new OpenStreamViewCommand(this.app, stream);
					command.execute();
				}
			);
			
			// Add attributes and styling
			streamIcons.view.setAttribute('data-stream-id', stream.id);
			streamIcons.view.setAttribute('data-icon-type', 'view');
			streamIcons.view.addClass('stream-view-icon');
			
			// Apply custom border styling based on stream settings
			this.applyViewIconStyles(streamIcons.view, stream);
			
			// Set initial visibility based on settings
			this.updateIconVisibility(streamIcons.view, stream.showFullStreamInRibbon);
		}
	}
	
	/**
	 * Apply custom styling to Today icon based on stream settings
	 */
	private applyTodayIconStyles(icon: HTMLElement, stream: Stream): void {
		console.log(`Applying Today icon styles for stream ${stream.id}. Border: ${stream.showTodayBorder}, Color: ${stream.todayBorderColor}`);
		
		// Remove existing CSS classes that might affect border styling
		icon.removeClass('stream-today-icon');
		
		// Reset all borders first to ensure clean slate
		icon.style.borderTop = 'none';
		icon.style.borderRight = 'none';
		icon.style.borderBottom = 'none';
		icon.style.borderLeft = 'none';
		
		// Apply border if enabled with !important to ensure it takes precedence
		if (stream.showTodayBorder) {
			const color = stream.todayBorderColor || 'var(--text-accent)';
			icon.style.setProperty('border-left', `2px solid ${color}`, 'important');
			// Add data attribute for debugging
			icon.setAttribute('data-border-enabled', 'true');
		} else {
			icon.style.setProperty('border-left', 'none', 'important');
			// Add data attribute for debugging
			icon.setAttribute('data-border-enabled', 'false');
		}
	}
	
	/**
	 * Apply custom styling to View icon based on stream settings
	 */
	private applyViewIconStyles(icon: HTMLElement, stream: Stream): void {
		console.log(`Applying View icon styles for stream ${stream.id}. Border: ${stream.showViewBorder}, Color: ${stream.viewBorderColor}`);
		
		// Remove existing CSS classes that might affect border styling
		icon.removeClass('stream-view-icon');
		
		// Reset all borders first to ensure clean slate
		icon.style.borderTop = 'none';
		icon.style.borderRight = 'none';
		icon.style.borderBottom = 'none';
		icon.style.borderLeft = 'none';
		
		// Apply border if enabled with !important to ensure it takes precedence
		if (stream.showViewBorder) {
			const color = stream.viewBorderColor || 'var(--text-success)';
			icon.style.setProperty('border-left', `2px solid ${color}`, 'important');
			// Add data attribute for debugging
			icon.setAttribute('data-border-enabled', 'true');
		} else {
			icon.style.setProperty('border-left', 'none', 'important');
			// Add data attribute for debugging
			icon.setAttribute('data-border-enabled', 'false');
		}
	}
	
	/**
	 * Update visibility of all icons based on current settings
	 */
	private updateAllIconVisibility(): void {
		this.settings.streams.forEach(stream => {
			this.updateStreamIconVisibility(stream);
		});
	}
	
	/**
	 * Update a single stream's icon visibility based on its settings
	 */
	private updateStreamIconVisibility(stream: Stream): void {
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (!streamIcons) return;
		
		console.log(`Updating visibility for stream ${stream.id}: Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
		
		// Update Today icon visibility
		if (streamIcons.today) {
			this.updateIconVisibility(streamIcons.today, stream.showTodayInRibbon);
		}
		
		// Update View icon visibility
		if (streamIcons.view) {
			this.updateIconVisibility(streamIcons.view, stream.showFullStreamInRibbon);
		}
	}
	
	/**
	 * Update a stream's Today icon
	 */
	public updateStreamTodayIcon(stream: Stream): void {
		console.log(`Toggle Today icon for stream ${stream.id} to ${stream.showTodayInRibbon}`);
		
		// Create icons if needed
		this.createStreamIcons(stream);
		
		// Update visibility
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (streamIcons?.today) {
			this.updateIconVisibility(streamIcons.today, stream.showTodayInRibbon);
			// Update styling
			this.applyTodayIconStyles(streamIcons.today, stream);
		}
	}
	
	/**
	 * Update a stream's View icon
	 */
	public updateStreamViewIcon(stream: Stream): void {
		console.log(`Toggle View icon for stream ${stream.id} to ${stream.showFullStreamInRibbon}`);
		
		// Create icons if needed
		this.createStreamIcons(stream);
		
		// Update visibility
		const streamIcons = this.ribbonIconsByStream.get(stream.id);
		if (streamIcons?.view) {
			this.updateIconVisibility(streamIcons.view, stream.showFullStreamInRibbon);
			// Update styling
			this.applyViewIconStyles(streamIcons.view, stream);
		}
	}
	
	/**
	 * Clean up all icons 
	 */
	private removeAllRibbonIcons(): void {
		// Let Obsidian handle proper cleanup of each icon
		this.ribbonIconsByStream.forEach((icons) => {
			if (icons.today) icons.today.detach();
			if (icons.view) icons.view.detach();
		});
		this.ribbonIconsByStream.clear();
	}
	
	onunload() {
		this.log.debug('Unloading Streams plugin...');
		this.cleanupResources();
	}
	
	/**
	 * Clean up all resources when plugin is unloaded
	 */
	private cleanupResources(): void {
		// Clean up styles
		document.getElementById('streams-calendar-styles')?.remove();
		
		// Clean up widgets
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();
		
		// Clean up ribbon icons
		this.removeAllRibbonIcons();
		
		this.commandsByStreamId.clear();
		this.viewCommandsByStreamId.clear();
	}
	
	/**
	 * Register all event handlers
	 */
	private registerEventHandlers(): void {
		// Register event for active leaf changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				this.log.debug('Active leaf changed');
				if (leaf?.view instanceof MarkdownView) {
					this.updateCalendarWidget(leaf);
				} else if (leaf?.view.getViewType() === CREATE_FILE_VIEW_TYPE) {
					// Also show calendar widget in the create file view
					this.updateCalendarWidgetForCreateView(leaf);
				}
			})
		);

		// Listen for CreateFileView state changes and update calendar widget accordingly
		this.registerEvent(
			// Use 'on' directly on app.workspace without type checking
			// @ts-ignore - Custom event not in type definitions
			this.app.workspace.on('streams-create-file-state-changed', (view: any) => {
				this.log.debug('Create file state changed, updating calendar widget');
				if (view && view.leaf) {
					this.updateCalendarWidgetForCreateView(view.leaf);
				}
			})
		);
	}
	
	/**
	 * Initialize mobile-specific features
	 */
	private initializeMobileIntegration(): void {
		// Mobile share handler (for Android)
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
	
	/**
	 * Initialize the active view's calendar widget
	 */
	private initializeActiveView(): void {
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (activeLeaf) {
			this.updateCalendarWidget(activeLeaf);
		}
	}

	/**
	 * Load and inject CSS styles for the plugin
	 */
	private loadStyles(): void {
		// Add a style element to the document head
		const styleEl = document.createElement('style');
		styleEl.id = 'streams-calendar-styles';
		document.head.appendChild(styleEl);
		
		styleEl.textContent = `
			.stream-calendar-widget {
				position: fixed;
				top: 80px;
				right: 0;
				z-index: 1000;
				font-size: 12px;
				background-color: var(--background-primary);
				border-radius: 6px 0 0 6px;
				box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.15);
				user-select: none;
				pointer-events: all;
			}

			.stream-calendar-collapsed {
				padding: 8px 12px;
				cursor: pointer;
				transition: opacity 0.3s ease;
			}

			.stream-calendar-today-button {
				color: var(--text-accent);
				font-weight: 600;
				transition: opacity 0.3s ease;
			}

			.today-button-expanded {
				opacity: 0;
			}

			.stream-calendar-expanded {
				padding: 12px;
				background-color: var(--background-primary);
				border-radius: 6px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
				opacity: 0;
				transform: scale(0.95);
				transition: all 0.3s ease;
			}

			.calendar-expanded {
				opacity: 1;
				transform: scale(1);
			}

			/* Rest of your existing calendar grid styles */
			.stream-calendar-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 12px;
			}

			.stream-calendar-nav {
				cursor: pointer;
				color: var(--text-muted);
				padding: 4px;
			}

			.stream-calendar-nav:hover {
				color: var(--text-normal);
			}

			.stream-calendar-date {
				font-weight: 600;
			}

			.stream-calendar-grid {
				display: grid;
				grid-template-columns: repeat(7, 1fr);
				gap: 4px;
			}

			.calendar-day {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 2px;
				padding: 4px;
				text-align: center;
				cursor: pointer;
				border-radius: 4px;
				transition: background-color 0.2s ease;
			}

			.dot-container {
				display: flex;
				gap: 2px;
				height: 4px;
			}

			.content-dot {
				width: 4px;
				height: 4px;
				border-radius: 50%;
				background-color: var(--text-muted);
			}

			.calendar-day:hover .content-dot {
				background-color: var(--text-normal);
			}

			.calendar-day.today .content-dot {
				background-color: var(--text-accent);
			}
		`;
	}

	private updateCalendarWidget(leaf: WorkspaceLeaf) {
		const view = leaf.view as MarkdownView;
		const filePath = view.file?.path;
		
		this.log.debug('Updating calendar widget for file:', filePath);

		// Remove existing widget if any
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();

		if (!filePath) return;

		// Log all streams first
		this.log.debug('Available streams:', this.settings.streams.map(s => ({
			name: s.name,
			folder: s.folder
		})));

		// Find which stream this file belongs to
		const stream = this.settings.streams.find(s => {
			// Normalize both paths to use forward slashes
			const normalizedFilePath = filePath.split(/[/\\]/).filter(Boolean);
			const normalizedStreamPath = s.folder.split(/[/\\]/).filter(Boolean);
			
			// Check if paths match at each level
			const isMatch = normalizedStreamPath.every((part, index) => normalizedStreamPath[index] === normalizedFilePath[index]);
			
			this.log.debug(`Checking stream "${s.name}":`, {
				filePath,
				streamFolder: s.folder,
				normalizedFilePath,
				normalizedStreamPath,
				isMatch
			});
			
			return isMatch;
		});

		if (stream) {
			this.log.debug('File belongs to stream:', stream.name);
			const widget = new CalendarWidget(leaf, stream, this.app);
			const widgetId = filePath || crypto.randomUUID();
			this.calendarWidgets.set(widgetId, widget);
		} else {
			this.log.debug('File does not belong to any stream');
		}
	}

	// Add new methods for handling stream link insertion
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

				// Create the link
				const link = this.app.fileManager.generateMarkdownLink(linkFile, streamPath);
				
				// Append the link to the stream note
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

	// Add new method to handle calendar widget for create file view
	private updateCalendarWidgetForCreateView(leaf: WorkspaceLeaf) {
		const view = leaf.view;
		if (!view) return;
		
		// Remove existing widget if any
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();
		
		try {
			// Get the stream and date from the view's state
			const state = view.getState();
			if (state && state.stream && state.date) {
				// Cast to appropriate types
				const stream = state.stream as Stream;
				const dateString = state.date as string;
				const date = new Date(dateString);
				
				this.log.debug('Creating calendar widget for create file view:', {
					stream: stream.name,
					date: date.toISOString()
				});
				
				// Create the calendar widget with the correct date
				const widget = new CalendarWidget(leaf, stream, this.app);
				
				// Extract date string in YYYY-MM-DD format for currentViewedDate
				const formattedDate = dateString.split('T')[0];
				
				// Set the currentViewedDate explicitly
				widget.setCurrentViewedDate(formattedDate);
				
				const widgetId = 'create-file-view-' + stream.id;
				this.calendarWidgets.set(widgetId, widget);
			}
			} catch (error) {
			this.log.error('Error setting up calendar widget for create view:', error);
		}
	}

	// Add a new method for adding stream view commands
	public addStreamViewCommand(stream: Stream) {
		const commandId = `streams-plugin:view-${stream.id}`;
		
		// Remove existing command if any
		this.removeStreamViewCommand(stream.id);

		// Add new command
		const command = this.addCommand({
			id: commandId,
			name: `${stream.name}, Full`,
			callback: async () => {
				const command = new OpenStreamViewCommand(this.app, stream);
				await command.execute();
			}
		});

		// Store command ID for later removal
		this.viewCommandsByStreamId.set(stream.id, commandId);
	}

	/**
	 * Remove the "View Full Stream" command
	 */
	public removeStreamViewCommand(streamId: string) {
		const commandId = this.viewCommandsByStreamId.get(streamId);
		if (commandId) {
			// Remove command from Obsidian
			this.removeCommand(commandId);
			this.viewCommandsByStreamId.delete(streamId);
			this.log.debug(`Removed View Full Stream command for stream ${streamId}`);
		}
	}

	/**
	 * Completely reset and rebuild all ribbon icons based on current settings
	 */
	public forceRebuildAllIcons(): void {
		console.log("=== FORCE REBUILDING ALL RIBBON ICONS ===");
		
		// First, ensure all icons are created
		this.settings.streams.forEach(stream => {
			this.createStreamIcons(stream);
		});
		
		// Then update their visibility
		this.updateAllIconVisibility();
		
		console.log("=== FORCE REBUILD COMPLETE ===");
	}

	/**
	 * Directly toggle a specific icon without affecting any other icons
	 */
	public directlyToggleSpecificRibbonIcon(type: 'today' | 'view', stream: Stream, enabled: boolean): void {
		console.log(`Directly toggling ${type} icon for ${stream.id} to ${enabled}`);
		
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
		
		// Ensure backward compatibility by adding viewIcon to any existing streams
		this.settings.streams.forEach(stream => {
			if (!stream.viewIcon) {
				stream.viewIcon = stream.icon;
			}
			
			// Migrate from old property names to new ones
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
			
			// Set defaults if values are undefined
			if (stream.showTodayInRibbon === undefined) {
				stream.showTodayInRibbon = false;
			}
			
			if (stream.showFullStreamInRibbon === undefined) {
				stream.showFullStreamInRibbon = false;
			}

			// Set defaults for new styling options
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
		});
	}

	/**
	 * Save settings
	 */
	async saveSettings(refreshUI: boolean = false) {
		console.log("Saving settings...");
		try {
			await this.saveData(this.settings);
			console.log("Settings saved successfully");
			
			// Log the currently saved state
			console.log("=== SAVED STREAM STATES ===");
			this.settings.streams.forEach(stream => {
				console.log(`Stream ${stream.id} (${stream.name}): Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
			});
			console.log("==========================");
			
			// Update visibility based on current settings
			this.updateAllIconVisibility();
		} catch (error) {
			console.error("Error saving settings:", error);
		}
	}
	
	/**
	 * Toggle commands
	 */
	public toggleStreamCommand(stream: Stream) {
		// Remove existing command first
		this.removeStreamCommand(stream.id);
		
		// Only add if enabled
		if (stream.addCommand) {
			this.addStreamCommand(stream);
		}
		
		this.log.debug(`Toggled Open Today command for stream ${stream.id} to ${stream.addCommand}`);
	}
	
	public toggleStreamViewCommand(stream: Stream) {
		// Remove existing view command first
		this.removeStreamViewCommand(stream.id);
		
		// Only add if enabled
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

		// Store command ID for later removal
		this.commandsByStreamId.set(stream.id, commandId);
	}

	/**
	 * Remove the "Open Today" command
	 */
	public removeStreamCommand(streamId: string) {
		const commandId = this.commandsByStreamId.get(streamId);
		if (commandId) {
			// Remove command from Obsidian
			this.removeCommand(commandId);
			this.commandsByStreamId.delete(streamId);
			this.log.debug(`Removed Open Today command for stream ${streamId}`);
		}
	}

	/**
	 * Update an icon's visibility with multiple approaches to ensure it sticks
	 */
	private updateIconVisibility(icon: HTMLElement, visible: boolean): void {
		// Log before state
		const wasVisible = icon.style.display !== 'none' && !icon.classList.contains('is-hidden');
		console.log(`Updating icon visibility: was ${wasVisible ? 'visible' : 'hidden'}, will be ${visible ? 'visible' : 'hidden'}`);
		
		// Capture the stream ID and icon type for later reapplying styles
		const streamId = icon.getAttribute('data-stream-id');
		const iconType = icon.getAttribute('data-icon-type');
		
		if (visible) {
			// Show the icon
			icon.classList.remove('is-hidden');
			
			// Preserve custom styling by not completely resetting inline styles
			// Only change display property
			icon.style.display = 'flex';
			
			// Ensure it's in the DOM
			if (!document.body.contains(icon)) {
				const ribbon = this.app.workspace.containerEl.querySelector(".side-dock-ribbon");
				if (ribbon) {
					ribbon.appendChild(icon);
				}
			}
			
			// Reapply custom styling if needed
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
			// Completely hide the icon
			icon.style.display = 'none';
			icon.classList.add('is-hidden');
		}
		
		// Log after state
		const isNowVisible = icon.style.display !== 'none' && !icon.classList.contains('is-hidden');
		console.log(`Icon visibility updated: now ${isNowVisible ? 'visible' : 'hidden'}`);
	}

	/**
	 * Initialize commands for streams that have them enabled
	 */
	public initializeStreamCommands(): void {
		this.log.debug('Initializing stream commands...');
		
		this.settings.streams.forEach(stream => {
			// Initialize "Open Today" command if enabled
			if (stream.addCommand) {
				this.addStreamCommand(stream);
				this.log.debug(`Added Open Today command for stream ${stream.name}`);
			}
			
			// Initialize "View Full Stream" command if enabled
			if (stream.addViewCommand) {
				this.addStreamViewCommand(stream);
				this.log.debug(`Added View Full Stream command for stream ${stream.name}`);
			}
		});
	}
}