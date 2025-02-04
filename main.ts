import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings } from './types';
import { createDailyNote, openStreamDate } from './streamUtils';
import { CalendarWidget } from './CalendarWidget';
import { normalize } from 'path';
import { Logger } from './src/utils/Logger';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';

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
	ribbonIconsByStreamId: Map<string, HTMLElement> = new Map();
	commandsByStreamId: Map<string, string> = new Map();
	calendarWidgets: Map<string, CalendarWidget> = new Map();
	private log: Logger = new Logger();

	async onload() {
		this.log.info('Loading Streams plugin...');
		
		// Load styles first
		this.loadStyles();
		
		await this.loadSettings();
		this.addSettingTab(new StreamsSettingTab(this.app, this));
		
		// Initialize ribbon icons
		this.settings.streams
			.filter(stream => stream.showInRibbon)
			.forEach(stream => this.addRibbonIconForStream(stream));

		// Register event for active leaf changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				this.log.debug('Active leaf changed');
				if (leaf?.view instanceof MarkdownView) {
					this.updateCalendarWidget(leaf);
				}
			})
		);

		// Initial setup
		const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
		if (activeLeaf) {
			this.updateCalendarWidget(activeLeaf);
		}

		// Initialize commands for streams that have it enabled
		this.settings.streams
			.filter(stream => stream.addCommand)
			.forEach(stream => this.addStreamCommand(stream));
	}

	private loadStyles() {
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
				padding: 4px;
				text-align: center;
				cursor: pointer;
				border-radius: 4px;
				transition: background-color 0.2s ease;
			}

			.calendar-day:hover {
				background-color: var(--background-modifier-hover);
			}

			.calendar-day.empty {
				cursor: default;
			}

			.calendar-day.empty:hover {
				background-color: transparent;
			}

			.calendar-day.today {
				color: var(--text-accent);
				font-weight: bold;
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

	onunload() {
		this.log.debug('Unloading Streams plugin...');
		
		// Clean up styles
		document.getElementById('streams-calendar-styles')?.remove();
		
		// Clean up widgets
		this.calendarWidgets.forEach((widget) => {
			widget.destroy();
		});
		this.calendarWidgets.clear();
		
		// Clean up ribbon icons
		this.ribbonIconsByStreamId.forEach(icon => icon.remove());
		this.ribbonIconsByStreamId.clear();

		this.commandsByStreamId.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Don't automatically refresh icons on every save
	}

	public addRibbonIconForStream(stream: Stream) {
		// Remove existing icon if any
		const existingIcon = this.ribbonIconsByStreamId.get(stream.id);
		if (existingIcon) {
			existingIcon.remove();
			this.ribbonIconsByStreamId.delete(stream.id);
		}

		// Create new icon with unique tooltip
		const ribbonIcon = this.addRibbonIcon(
			stream.icon,
			`Stream: ${stream.name} (${stream.id})`,
			async () => {
				const command = new OpenTodayStreamCommand(this.app, stream);
				await command.execute();
			}
		);

		// Store reference with stream ID
		this.ribbonIconsByStreamId.set(stream.id, ribbonIcon);
		
		this.log.debug(`Added icon for stream ${stream.id}, total icons: ${this.ribbonIconsByStreamId.size}`);
	}

	public removeRibbonIconForStream(streamId: string) {
		const icon = this.ribbonIconsByStreamId.get(streamId);
		if (icon) {
			icon.remove();
			this.ribbonIconsByStreamId.delete(streamId);
			this.log.debug(`Removed icon for stream ${streamId}`);
		}
	}

	public toggleRibbonIcon(stream: Stream) {
		if (stream.showInRibbon) {
			this.addRibbonIconForStream(stream);
		} else {
			this.removeRibbonIconForStream(stream.id);
		}
	}

	public toggleStreamCommand(stream: Stream) {
		if (stream.addCommand) {
			this.addStreamCommand(stream);
		} else {
			this.removeStreamCommand(stream.id);
		}
	}

	private addStreamCommand(stream: Stream) {
		const commandId = `streams-plugin:open-${stream.id}`;
		
		// Remove existing command if any
		this.removeStreamCommand(stream.id);

		// Add new command
		const command = this.addCommand({
			id: commandId,
			name: `Open Today's Note: ${stream.name}`,
			callback: async () => {
				const command = new OpenTodayStreamCommand(this.app, stream);
				await command.execute();
			}
		});

		// Store command ID for later removal
		this.commandsByStreamId.set(stream.id, commandId);
	}

	private removeStreamCommand(streamId: string) {
		const commandId = this.commandsByStreamId.get(streamId);
		if (commandId) {
			// Remove command from Obsidian
			this.removeCommand(commandId);
			this.commandsByStreamId.delete(streamId);
		}
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
