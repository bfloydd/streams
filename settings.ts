import { App, PluginSettingTab, Setting } from 'obsidian';
import StreamsPlugin from './main';
import { Stream, StreamsSettings, LucideIcon } from './types';
import { getFolderSuggestions } from './streamUtils';

export class StreamsSettingTab extends PluginSettingTab {
    plugin: StreamsPlugin;

    constructor(app: App, plugin: StreamsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Streams Settings' });

        // Add new stream button
        new Setting(containerEl)
            .setName('Add Stream')
            .setDesc('Create a new note stream')
            .addButton(button => button
                .setButtonText('Add Stream')
                .setCta()
                .onClick(async () => {
                    const newStream: Stream = {
                        id: crypto.randomUUID(),
                        name: 'New Stream',
                        folder: '',
                        icon: 'file-text' as LucideIcon,
                        showInRibbon: true,
                        addCommand: false
                    };
                    this.plugin.settings.streams.push(newStream);
                    await this.plugin.saveSettings();
                    // Add the ribbon icon after saving
                    this.plugin.addRibbonIconForStream(newStream);
                    this.display();
                }));

        // Stream cards
        const streamsContainer = containerEl.createDiv('streams-container');
        streamsContainer.addClass('streams-grid');

        this.plugin.settings.streams.forEach((stream, index) => {
            const streamCard = this.createStreamCard(streamsContainer, stream, index);
            this.addStreamSettings(streamCard, stream, index);
        });
    }

    private createStreamCard(container: HTMLElement, stream: Stream, index: number): HTMLElement {
        const card = container.createDiv('stream-card');
        card.createEl('h3', { text: stream.name });
        return card;
    }

    private addStreamSettings(card: HTMLElement, stream: Stream, index: number) {
        new Setting(card)
            .setName('Stream Name')
            .addText(text => text
                .setValue(stream.name)
                .onChange(async (value) => {
                    stream.name = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Folder')
            .addText(text => text
                .setValue(stream.folder)
                .setPlaceholder('folder/path')
                .then(textComponent => {
                    // Add folder autocomplete
                    const folders = getFolderSuggestions(this.app);
                    textComponent.inputEl.setAttribute('list', 'folder-list');
                    const datalist = textComponent.inputEl.createEl('datalist', {
                        attr: { id: 'folder-list' }
                    });
                    folders.forEach(folder => {
                        datalist.createEl('option', { value: folder });
                    });
                })
                .onChange(async (value) => {
                    const normalizedPath = value.split(/[/\\]/).filter(Boolean).join('/');
                    stream.folder = normalizedPath;
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Show in Ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showInRibbon)
                .onChange(async (value) => {
                    stream.showInRibbon = value;
                    this.plugin.toggleRibbonIcon(stream);
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Add Command')
            .setDesc('Add this stream to the command palette')
            .addToggle(toggle => toggle
                .setValue(stream.addCommand ?? false)
                .onChange(async (value) => {
                    stream.addCommand = value;
                    this.plugin.toggleStreamCommand(stream);
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Icon')
            .addDropdown(dropdown => {
                const iconCategories = {
                    'Files & Documents': ['file-text', 'file', 'files', 'folder', 'book', 'notebook', 'diary'],
                    'Communication': ['message-circle', 'message-square', 'mail', 'inbox', 'send'],
                    'Time & Planning': ['alarm-check', 'calendar', 'clock', 'timer', 'history'],
                    'UI Elements': ['home', 'settings', 'search', 'bookmark', 'star', 'heart'],
                    'Content': ['text', 'edit', 'pencil', 'pen', 'list', 'check-square'],
                    'Media': ['image', 'video', 'music', 'camera'],
                    'Weather': ['sun', 'moon', 'cloud', 'umbrella'],
                    'Misc': ['user', 'users', 'tag', 'flag', 'bookmark', 'link']
                } as const;

                Object.entries(iconCategories).forEach(([category, icons]) => {
                    dropdown.addOption(`---${category}---`, category); // Add category header
                    icons.forEach(icon => dropdown.addOption(icon, icon));
                });

                dropdown
                    .setValue(stream.icon)
                    .onChange(async (value: LucideIcon) => {
                        stream.icon = value;
                        // Refresh the ribbon icon immediately if it's showing
                        if (stream.showInRibbon) {
                            this.plugin.addRibbonIconForStream(stream);
                        }
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(card)
            .addButton(button => button
                .setButtonText('Delete Stream')
                .setWarning()
                .onClick(async () => {
                    // Remove the ribbon icon first
                    this.plugin.removeRibbonIconForStream(stream.id);
                    // Then remove from settings
                    this.plugin.settings.streams.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display();
                }));
    }
} 