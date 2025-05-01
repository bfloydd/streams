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
	customIconContainer: HTMLElement | null = null; // Custom container for our icons
	commandsByStreamId: Map<string, string> = new Map();
	viewCommandsByStreamId: Map<string, string> = new Map();
	calendarWidgets: Map<string, CalendarWidget> = new Map();
	private log: Logger = new Logger();

	async onload() {
		this.log.info('Loading Streams plugin...');
		
		// Load settings and styles
		await this.loadSettings();
		this.loadStyles();
		
		// Remove any existing ribbon icons using the previous approach
		this.cleanupLegacyRibbonIcons();
		
		// Register plugin components
		this.registerPluginViews();
		
		// Initialize our custom icon system
		this.initializeCustomIconSystem();
		
		// Add settings tab
		this.addSettingTab(new StreamsSettingTab(this.app, this));
		
		// Register remaining components
		this.registerEventHandlers();
		this.initializeMobileIntegration();
		this.initializeActiveView();
		
		// Create a MutationObserver to watch for changes to the ribbon
		this.watchForRibbonChanges();
		
		this.log.info('Streams plugin loaded successfully');
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
				addViewCommand: false 
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
				addViewCommand: false
			};
		}
		
		return new StreamViewWidget(leaf, this.app, stream);
	}
	
	/**
	 * Clean up old ribbon icons
	 */
	private cleanupLegacyRibbonIcons(): void {
		const ribbonEl = this.app.workspace.containerEl.querySelector(".side-dock-ribbon");
		if (ribbonEl) {
			// Look for any icon with our patterns
			const allRibbonIcons = ribbonEl.querySelectorAll(".side-dock-ribbon-action");
			allRibbonIcons.forEach(icon => {
				const iconEl = icon as HTMLElement;
				const tooltip = iconEl.getAttribute("aria-label") || "";
				
				// Check tooltip text for our patterns (both today and view patterns)
				if (tooltip.includes("Today:") || tooltip.includes("View:")) {
					try { iconEl.remove(); } catch(e) { }
				}
			});
		}
	}
	
	/**
	 * Initialize our custom icon system
	 */
	private initializeCustomIconSystem(): void {
		// Find or create our container
		this.createCustomIconContainer();
		
		// Render icons based on current settings
		this.renderCustomIcons();
		
		// Watch for ribbon changes to ensure our container stays in place
		this.registerInterval(window.setInterval(() => {
			if (!document.body.contains(this.customIconContainer)) {
				this.createCustomIconContainer();
				this.renderCustomIcons();
			}
		}, 1000));
	}
	
	/**
	 * Create a container for our custom icons
	 */
	private createCustomIconContainer(): void {
		// Remove existing container if any
		if (this.customIconContainer) {
			this.customIconContainer.remove();
		}
		
		// Find the ribbon container
		const ribbonEl = this.app.workspace.containerEl.querySelector(".side-dock-ribbon");
		if (!ribbonEl) return;
		
		// Create our custom container
		this.customIconContainer = document.createElement('div');
		this.customIconContainer.addClass('streams-custom-icon-container');
		this.customIconContainer.setAttribute('data-streams-icon-container', 'true');
		
		// Insert it into the ribbon (safer approach)
		try {
			// First try to find direct children of the ribbon
			const allDirectChildren = Array.from(ribbonEl.children);
			const firstRibbonIcon = allDirectChildren.find(child => 
				child.hasClass('side-dock-ribbon-action')
			);
			
			if (firstRibbonIcon && ribbonEl.contains(firstRibbonIcon)) {
				ribbonEl.insertBefore(this.customIconContainer, firstRibbonIcon);
			} else {
				// Fallback to appending at the top
				const firstChild = ribbonEl.firstChild;
				if (firstChild) {
					ribbonEl.insertBefore(this.customIconContainer, firstChild);
				} else {
					// Last resort: append to the ribbon
					ribbonEl.appendChild(this.customIconContainer);
				}
			}
		} catch (error) {
			console.error("Error inserting custom icon container:", error);
			// Final fallback: just append
			try {
				ribbonEl.appendChild(this.customIconContainer);
			} catch (e) {
				console.error("Failed to add custom icon container:", e);
			}
		}
	}
	
	/**
	 * Watch for changes to the ribbon
	 */
	private watchForRibbonChanges(): void {
		const observer = new MutationObserver((mutations) => {
			// If our container was removed, re-add it
			if (!document.body.contains(this.customIconContainer)) {
				this.createCustomIconContainer();
				this.renderCustomIcons();
			}
		});
		
		// Watch the ribbon for changes
		const ribbonEl = this.app.workspace.containerEl.querySelector(".side-dock-ribbon");
		if (ribbonEl) {
			observer.observe(ribbonEl, { 
				childList: true,
				subtree: true
			});
		}
	}
	
	/**
	 * Render all custom icons based on current settings
	 */
	private renderCustomIcons(): void {
		// Make sure we have a container
		if (!this.customIconContainer) return;
		
		// Clear existing icons
		this.customIconContainer.empty();
		
		// Add icons based on settings
		this.settings.streams.forEach(stream => {
			// Add Today icon if enabled
			if (stream.showTodayInRibbon) {
				this.addCustomTodayIcon(stream);
			}
			
			// Add View icon if enabled
			if (stream.showFullStreamInRibbon) {
				this.addCustomViewIcon(stream);
			}
		});
	}
	
	/**
	 * Add a Today icon to our custom container
	 */
	private addCustomTodayIcon(stream: Stream): void {
		if (!this.customIconContainer) return;
		
		// Create icon element
		const iconWrapper = document.createElement('div');
		iconWrapper.addClass('streams-custom-icon');
		iconWrapper.addClass('streams-today-icon');
		iconWrapper.setAttribute('data-stream-id', stream.id);
		iconWrapper.setAttribute('data-icon-type', 'today');
		iconWrapper.setAttribute('aria-label', `Today: ${stream.name}`);
		iconWrapper.setAttribute('aria-label-position', 'right');
		
		// Set up icon
		const iconEl = document.createElement('div');
		iconEl.addClass('streams-icon-inner');
		// Set icon using setIcon to use Obsidian's icon system
		setIcon(iconEl, stream.icon);
		
		// Add click handler
		iconWrapper.addEventListener('click', () => {
			const command = new OpenTodayStreamCommand(this.app, stream);
			command.execute();
		});
		
		// Add to container
		iconWrapper.appendChild(iconEl);
		this.customIconContainer.appendChild(iconWrapper);
	}
	
	/**
	 * Add a View icon to our custom container
	 */
	private addCustomViewIcon(stream: Stream): void {
		if (!this.customIconContainer) return;
		
		// Create icon element
		const iconWrapper = document.createElement('div');
		iconWrapper.addClass('streams-custom-icon');
		iconWrapper.addClass('streams-view-icon');
		iconWrapper.setAttribute('data-stream-id', stream.id);
		iconWrapper.setAttribute('data-icon-type', 'view');
		iconWrapper.setAttribute('aria-label', `View: ${stream.name}`);
		iconWrapper.setAttribute('aria-label-position', 'right');
		
		// Set up icon
		const iconEl = document.createElement('div');
		iconEl.addClass('streams-icon-inner');
		// Set icon using setIcon to use Obsidian's icon system
		setIcon(iconEl, stream.viewIcon || stream.icon);
		
		// Add click handler
		iconWrapper.addEventListener('click', () => {
			const command = new OpenStreamViewCommand(this.app, stream);
			command.execute();
		});
		
		// Add to container
		iconWrapper.appendChild(iconEl);
		this.customIconContainer.appendChild(iconWrapper);
	}
	
	/**
	 * Update a stream's Today icon
	 */
	public updateStreamTodayIcon(stream: Stream): void {
		// Just re-render all icons
		this.renderCustomIcons();
	}
	
	/**
	 * Update a stream's View icon
	 */
	public updateStreamViewIcon(stream: Stream): void {
		// Just re-render all icons
		this.renderCustomIcons();
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
		
		// Clean up custom icon container
		if (this.customIconContainer) {
			this.customIconContainer.remove();
			this.customIconContainer = null;
		}
		
		// Clean up legacy icons (just in case)
		this.cleanupLegacyRibbonIcons();
		
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
			name: `${stream.name}: View Full Stream`,
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
	 * This is a nuclear approach to ensure the UI state matches the settings
	 */
	public forceRebuildAllIcons(): void {
		console.log("=== FORCE REBUILDING ALL RIBBON ICONS ===");
		
		// First completely remove all existing icons
		this.forceRemoveAllRibbonIcons();
		
		// Now add back only the icons that should be enabled
		this.settings.streams.forEach(stream => {
			console.log(`Checking stream ${stream.id}: Today=${stream.showTodayInRibbon}, View=${stream.showFullStreamInRibbon}`);
			
			// Add Today icon if enabled in settings
			if (stream.showTodayInRibbon) {
				console.log(`Adding Today icon for ${stream.id}`);
				this.addCustomTodayIcon(stream);
			}
			
			// Add View icon if enabled in settings
			if (stream.showFullStreamInRibbon) {
				console.log(`Adding View icon for ${stream.id}`);
				this.addCustomViewIcon(stream);
			}
		});
		
		console.log("=== FORCE REBUILD COMPLETE ===");
	}

	/**
	 * Aggressively remove ALL ribbon icons related to streams
	 */
	public forceRemoveAllRibbonIcons(): void {
		console.log("Forcefully removing ALL ribbon icons");
		
		// Remove all stream icons by selecting them directly from the DOM
		document.querySelectorAll('[data-stream-id]').forEach(icon => {
			try { icon.remove(); } catch(e) { /* ignore */ }
		});
		
		// Also try to remove by class
		document.querySelectorAll('.streams-custom-icon').forEach(icon => {
			try { icon.remove(); } catch(e) { /* ignore */ }
		});
		
		// Also try to find by specific IDs
		document.querySelectorAll('.side-dock-ribbon-action').forEach(icon => {
			const iconEl = icon as HTMLElement;
			if (iconEl.id && (iconEl.id.startsWith('stream-today-') || iconEl.id.startsWith('stream-view-'))) {
				try { iconEl.remove(); } catch(e) { /* ignore */ }
			}
		});
		
		console.log("Force removal complete");
	}

	/**
	 * Directly toggle a specific icon without affecting any other icons
	 */
	public directlyToggleSpecificRibbonIcon(type: 'today' | 'view', stream: Stream, enabled: boolean): void {
		console.log(`Directly toggling ${type} icon for ${stream.id} to ${enabled}`);
		
		// Step 1: Perform targeted removal first
		if (type === 'today') {
			// Find and remove by ID
			const iconById = document.getElementById(`stream-today-${stream.id}`);
			if (iconById) {
				try { iconById.remove(); } catch(e) { /* ignore */ }
			}
			
			// Find and remove by query selector
			document.querySelectorAll(`[data-stream-id="${stream.id}"][data-icon-type="today"]`).forEach(icon => {
				try { icon.remove(); } catch(e) { /* ignore */ }
			});
		} else {
			// Find and remove by ID
			const iconById = document.getElementById(`stream-view-${stream.id}`);
			if (iconById) {
				try { iconById.remove(); } catch(e) { /* ignore */ }
			}
			
			// Find and remove by query selector
			document.querySelectorAll(`[data-stream-id="${stream.id}"][data-icon-type="view"]`).forEach(icon => {
				try { icon.remove(); } catch(e) { /* ignore */ }
			});
		}
		
		// Step 2: Add icon if enabled
		if (enabled) {
			if (type === 'today') {
				this.addCustomTodayIcon(stream);
			} else {
				this.addCustomViewIcon(stream);
			}
		}
		
		// Step 3: Force a complete rebuild to ensure consistency
		setTimeout(() => {
			this.forceRebuildAllIcons();
		}, 50);
	}

	/**
	 * Verify that the ribbon state matches the settings and fix if not
	 */
	private verifyRibbonStateMatchesSettings(): void {
		// Create sets of stream IDs that should have icons
		const shouldHaveTodayIcon = new Set<string>();
		const shouldHaveViewIcon = new Set<string>();
		
		// Determine which streams should have icons based on settings
		this.settings.streams.forEach(stream => {
			if (stream.showTodayInRibbon) {
				shouldHaveTodayIcon.add(stream.id);
			}
			if (stream.showFullStreamInRibbon) {
				shouldHaveViewIcon.add(stream.id);
			}
		});
		
		// Check existing today icons
		let needsRebuild = false;
		
		// Check all ribbon icons in the DOM
		document.querySelectorAll('.side-dock-ribbon-action').forEach(icon => {
			const iconEl = icon as HTMLElement;
			
			// Check for today icons
			if (iconEl.id && iconEl.id.startsWith('stream-today-')) {
				const streamId = iconEl.id.replace('stream-today-', '');
				if (!shouldHaveTodayIcon.has(streamId)) {
					console.log(`Found unauthorized Today icon for stream ${streamId}, removing`);
					try { iconEl.remove(); } catch(e) { /* ignore */ }
					needsRebuild = true;
				}
			}
			
			// Check for view icons
			if (iconEl.id && iconEl.id.startsWith('stream-view-')) {
				const streamId = iconEl.id.replace('stream-view-', '');
				if (!shouldHaveViewIcon.has(streamId)) {
					console.log(`Found unauthorized View icon for stream ${streamId}, removing`);
					try { iconEl.remove(); } catch(e) { /* ignore */ }
					needsRebuild = true;
				}
			}
		});
		
		// Check if any icons are missing that should be there
		this.settings.streams.forEach(stream => {
			if (stream.showTodayInRibbon) {
				const iconEl = document.getElementById(`stream-today-${stream.id}`);
				if (!iconEl) {
					console.log(`Missing Today icon for stream ${stream.id}, will rebuild`);
					needsRebuild = true;
				}
			}
			
			if (stream.showFullStreamInRibbon) {
				const iconEl = document.getElementById(`stream-view-${stream.id}`);
				if (!iconEl) {
					console.log(`Missing View icon for stream ${stream.id}, will rebuild`);
					needsRebuild = true;
				}
			}
		});
		
		// If there's any inconsistency, force a complete rebuild
		if (needsRebuild) {
			console.log("Inconsistency detected between settings and ribbon state, forcing rebuild");
			this.forceRebuildAllIcons();
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
		});
	}
	
	/**
	 * Save settings and optionally refresh UI
	 */
	async saveSettings(refreshUI: boolean = false) {
		// First save the data
		console.log("Saving settings...");
		try {
			await this.saveData(this.settings);
			console.log("Settings saved successfully");
			
			// Always re-render our custom icons when settings change
			this.renderCustomIcons();
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
			name: `${stream.name}: Open Today`,
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
}