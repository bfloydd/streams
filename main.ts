import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings } from './types';
import { createDailyNote } from './streamUtils';

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

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StreamsSettingTab(this.app, this));
		// Initialize ribbon icons
		this.settings.streams
			.filter(stream => stream.showInRibbon)
			.forEach(stream => this.addRibbonIconForStream(stream));
	}

	onunload() {
		this.ribbonIconsByStreamId.forEach(icon => icon.remove());
		this.ribbonIconsByStreamId.clear();
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
				const file = await createDailyNote(this.app, stream.folder);
				if (file) {
					const leaf = this.app.workspace.getLeaf(true);
					await leaf.openFile(file);
					this.app.workspace.revealLeaf(leaf);
				}
			}
		);

		// Store reference with stream ID
		this.ribbonIconsByStreamId.set(stream.id, ribbonIcon);
		
		console.log(`Added icon for stream ${stream.id}, total icons: ${this.ribbonIconsByStreamId.size}`);
	}

	public removeRibbonIconForStream(streamId: string) {
		const icon = this.ribbonIconsByStreamId.get(streamId);
		if (icon) {
			icon.remove();
			this.ribbonIconsByStreamId.delete(streamId);
			console.log(`Removed icon for stream ${streamId}`);
		}
	}

	public toggleRibbonIcon(stream: Stream) {
		if (stream.showInRibbon) {
			this.addRibbonIconForStream(stream);
		} else {
			this.removeRibbonIconForStream(stream.id);
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
