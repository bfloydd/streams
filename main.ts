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

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new StreamsSettingTab(this.app, this));

		// Add ribbon icons for each active stream
		this.refreshStreamRibbons();
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(refreshRibbon: boolean = false) {
		await this.saveData(this.settings);
		if (refreshRibbon) {
			this.refreshStreamRibbons();
		}
	}

	private refreshStreamRibbons() {
		// First remove all existing stream ribbon icons
		const ribbonIconsToRemove = document.querySelectorAll('.stream-ribbon-icon');
		ribbonIconsToRemove.forEach(icon => {
			icon.remove();
		});

		// Then add ribbon icons for enabled streams
		this.settings.streams
			.filter(stream => stream.showInRibbon)
			.forEach(stream => {
				this.addStreamRibbonIcon(stream);
			});
	}

	private addStreamRibbonIcon(stream: Stream) {
		return this.addRibbonIcon(stream.icon, `Open Today's ${stream.name} Note`, async () => {
			const file = await createDailyNote(this.app, stream.folder);
			if (file) {
				// Create a new leaf and ensure it's active
				const leaf = this.app.workspace.getLeaf(true);
				// Open the file and ensure it's focused
				await leaf.openFile(file);
				this.app.workspace.revealLeaf(leaf);
			}
		}).addClass('stream-ribbon-icon');
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
