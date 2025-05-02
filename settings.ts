import { App, PluginSettingTab, Setting } from 'obsidian';
import StreamsPlugin from './main';
import { Stream, StreamsSettings, LucideIcon } from './types';
import { getFolderSuggestions } from './src/utils/streamUtils';
import { OpenTodayStreamCommand } from './src/commands/OpenTodayStreamCommand';
import { OpenStreamViewCommand } from './src/commands/OpenStreamViewCommand';

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
                        viewIcon: 'layout-dashboard' as LucideIcon,
                        showTodayInRibbon: true,
                        showFullStreamInRibbon: false,
                        addCommand: false,
                        addViewCommand: false,
                        showTodayBorder: true,
                        showViewBorder: true,
                        todayBorderColor: 'var(--text-accent)',
                        viewBorderColor: 'var(--text-success)'
                    };
                    this.plugin.settings.streams.push(newStream);
                    await this.plugin.saveSettings(true); // Force UI refresh
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
        // Stream name setting
        new Setting(card)
            .setName('Name')
            .addText(text => text
                .setValue(stream.name)
                .onChange(async (value) => {
                    stream.name = value;
                    this.plugin.addStreamViewCommand(stream);
                    await this.plugin.saveSettings();
                }));

        // Folder setting
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

        // ===== RIBBON SECTION =====
        card.createEl('h4', { text: 'Ribbon Controls', cls: 'setting-header' });

        // Open Today ribbon
        new Setting(card)
            .setName('Open Today in Ribbon')
            .setDesc('Show the "Open Today" button in the sidebar ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayInRibbon)
                .onChange(async (value) => {
                    stream.showTodayInRibbon = value;
                    this.plugin.updateStreamTodayIcon(stream);
                    await this.plugin.saveSettings();
                }));

        // Today Icon
        new Setting(card)
            .setName('Today Icon')
            .setDesc('Icon for the "Open Today" ribbon button')
            .setClass('setting-indent')
            .addDropdown(dropdown => {
                this.populateIconDropdown(dropdown);
                dropdown
                    .setValue(stream.icon)
                    .onChange(async (value: LucideIcon) => {
                        stream.icon = value;
                        await this.plugin.saveSettings(true);
                    });
            });

        // Today Border Toggle
        new Setting(card)
            .setName('Show Today Border')
            .setDesc('Display a colored border on the left side of the Today icon')
            .setClass('setting-indent')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayBorder ?? true)
                .onChange(async (value) => {
                    stream.showTodayBorder = value;
                    this.plugin.updateStreamTodayIcon(stream);
                    await this.plugin.saveSettings();
                    
                    // Re-render the settings to show/hide the color option immediately
                    this.display();
                }));

        // Today Border Color
        if (stream.showTodayBorder) {
            new Setting(card)
                .setName('Border Color')
                // .setDesc('Color for the left border of the Today icon')
                .setClass('setting-double-indent')
                .addText(text => text
                    .setValue(stream.todayBorderColor ?? 'var(--text-accent)')
                    .setPlaceholder('var(--text-accent)')
                    .onChange(async (value) => {
                        stream.todayBorderColor = value;
                        this.plugin.updateStreamTodayIcon(stream);
                        await this.plugin.saveSettings();
                    }));
        }

        // View Stream ribbon
        new Setting(card)
            .setName('View Full Stream in Ribbon')
            .setDesc('Show the "View Full Stream" button in the sidebar ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showFullStreamInRibbon)
                .onChange(async (value) => {
                    stream.showFullStreamInRibbon = value;
                    this.plugin.updateStreamViewIcon(stream);
                    await this.plugin.saveSettings();
                }));
                
        // View Icon
        new Setting(card)
            .setName('View Icon')
            .setDesc('Icon for the "View Full Stream" ribbon button')
            .setClass('setting-indent')
            .addDropdown(dropdown => {
                this.populateIconDropdown(dropdown);
                dropdown
                    .setValue(stream.viewIcon || stream.icon)
                    .onChange(async (value: LucideIcon) => {
                        stream.viewIcon = value;
                        await this.plugin.saveSettings(true);
                    });
            });

        // View Border Toggle
        new Setting(card)
            .setName('Show View Border')
            .setDesc('Display a colored border on the left side of the View icon')
            .setClass('setting-indent')
            .addToggle(toggle => toggle
                .setValue(stream.showViewBorder ?? true)
                .onChange(async (value) => {
                    stream.showViewBorder = value;
                    this.plugin.updateStreamViewIcon(stream);
                    await this.plugin.saveSettings();
                    
                    // Re-render the settings to show/hide the color option immediately
                    this.display();
                }));

        // View Border Color
        if (stream.showViewBorder) {
            new Setting(card)
                .setName('Border Color')
                // .setDesc('Color for the left border of the View icon')
                .setClass('setting-double-indent')
                .addText(text => text
                    .setValue(stream.viewBorderColor ?? 'var(--text-success)')
                    .setPlaceholder('var(--text-success)')
                    .onChange(async (value) => {
                        stream.viewBorderColor = value;
                        this.plugin.updateStreamViewIcon(stream);
                        await this.plugin.saveSettings();
                    }));
        }

        // ===== COMMANDS SECTION =====
        card.createEl('h4', { text: 'Command Palette', cls: 'setting-header' });

        // Command palette integration
        new Setting(card)
            .setName('Add command: Open Today')
            .setDesc('Add this stream to the command palette')
            .addToggle(toggle => toggle
                .setValue(stream.addCommand ?? false)
                .onChange(async (value) => {
                    stream.addCommand = value;
                    this.plugin.toggleStreamCommand(stream);
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Add command: View Full Stream')
            .setDesc('Add a view command to the command palette')
            .addToggle(toggle => toggle
                .setValue(stream.addViewCommand ?? false)
                .onChange(async (value) => {
                    stream.addViewCommand = value;
                    this.plugin.toggleStreamViewCommand(stream);
                    await this.plugin.saveSettings();
                }));

        // ===== DELETE SECTION =====
        new Setting(card)
            .setName('Delete Stream')
            .setDesc('Permanently remove this stream')
            .addButton(button => button
                .setButtonText('Delete')
                .setWarning()
                .onClick(async () => {
                    // Remove all UI elements for this stream
                    console.log(`Deleting stream ${stream.id} (${stream.name})`);
                    
                    // Remove from settings
                    this.plugin.settings.streams.splice(index, 1);
                    
                    // Save settings with UI refresh
                    await this.plugin.saveSettings(true);
                    
                    // Clean up commands
                    this.plugin.removeStreamCommand(stream.id);
                    this.plugin.removeStreamViewCommand(stream.id);
                    
                    // Redisplay the settings tab
                    this.display();
                }));
    }

    private populateIconDropdown(dropdown: any) {
        const iconCategories = {
            'Files & Documents': ['file-text', 'file', 'files', 'folder', 'book', 'notebook', 'diary'],
            'Communication': ['message-circle', 'message-square', 'mail', 'inbox', 'send'],
            'Time & Planning': ['alarm-check', 'calendar', 'clock', 'timer', 'history'],
            'UI Elements': ['home', 'settings', 'search', 'bookmark', 'star', 'heart', 'layout-dashboard'],
            'Content': ['text', 'edit', 'pencil', 'pen', 'list', 'check-square'],
            'Media': ['image', 'video', 'music', 'camera'],
            'Weather': ['sun', 'moon', 'cloud', 'umbrella'],
            'Misc': ['user', 'users', 'tag', 'flag', 'bookmark', 'link']
        } as const;

        Object.entries(iconCategories).forEach(([category, icons]) => {
            dropdown.addOption(`---${category}---`, category); // Add category header
            icons.forEach(icon => dropdown.addOption(icon, icon));
        });
    }
} 