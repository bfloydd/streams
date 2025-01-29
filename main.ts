import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { StreamsSettingTab } from './settings';
import { Stream, StreamsSettings } from './types';
import { createDailyNote } from './streamUtils';

// Remember to rename these classes and interfaces!

const DEFAULT_SETTINGS: StreamsSettings = {
	streams: []
}

export default class StreamsPlugin extends Plugin {
	settings: StreamsSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new StreamsSettingTab(this.app, this));

		// Add ribbon icons for each active stream
		this.refreshStreamRibbons();
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshStreamRibbons();
	}

	private refreshStreamRibbons() {
		// Remove old icons by their class
		document.querySelectorAll('.stream-ribbon-icon').forEach(icon => icon.remove());

		// Add ribbon icons for enabled streams
		this.settings.streams.forEach(stream => {
			if (stream.showInRibbon) {
				this.addStreamRibbonIcon(stream);
			}
		});
	}

	private addStreamRibbonIcon(stream: Stream) {
		return this.addRibbonIcon(stream.icon, `Open Today's ${stream.name} Note`, async () => {
			await createDailyNote(this.app, stream.folder);
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
