import { App, PluginSettingTab, Setting, Notice, TFolder, MarkdownView } from 'obsidian';
import StreamsPlugin from './main';
import { Stream, StreamsSettings, LucideIcon } from './types';
import { FolderSuggest } from './src/settings/FolderSuggest';

export class StreamsSettingTab extends PluginSettingTab {
    plugin: StreamsPlugin;

    constructor(app: App, plugin: StreamsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Show calendar component')
            .setDesc('Show the calendar component in stream notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCalendarComponent)
                .onChange(async (value) => {
                    this.plugin.settings.showCalendarComponent = value;
                    await this.plugin.saveSettings();
                    
                    // Use the refresh method to immediately update all components
                    this.plugin.refreshAllCalendarComponents();
                    
                    new Notice(`Calendar component ${value ? 'shown' : 'hidden'}`);
                }));
                
        new Setting(containerEl).setName('Streams').setHeading();

        new Setting(containerEl)
            .setName('Add stream')
            .setDesc('Create a new note stream')
            .addButton(button => button
                .setButtonText('Add stream')
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
                    await this.plugin.saveSettings(true);
                    this.display();
                }));

        const streamsContainer = containerEl.createDiv('streams-plugin-container');

        this.plugin.settings.streams.forEach((stream, index) => {
            const streamCard = this.createStreamCard(streamsContainer, stream, index);
            this.addStreamSettings(streamCard, stream, index);
        });
    }

    private createStreamCard(container: HTMLElement, stream: Stream, index: number): HTMLElement {
        const card = container.createDiv('streams-plugin-card');
        card.createEl('h3', { text: stream.name });
        return card;
    }

    private addStreamSettings(card: HTMLElement, stream: Stream, index: number) {
        new Setting(card)
            .setName('Name')
            .addText(text => text
                .setValue(stream.name)
                .onChange(async (value) => {
                    stream.name = value;
                })
                .then(textComponent => {
                    textComponent.inputEl.addEventListener('blur', async () => {
                        this.plugin.addStreamViewCommand(stream);
                        await this.plugin.saveSettings();
                    });
                }));

        new Setting(card)
            .setName('Folder')
            .setDesc('Select or type a folder path')
            .addSearch(search => {
                search
                    .setValue(stream.folder)
                    .setPlaceholder('folder/path')
                    .onChange(async (value) => {
                        const normalizedPath = value.split(/[/\\]/).filter(Boolean).join('/');
                        
                        const pathExists = await this.validateFolderPath(normalizedPath);
                        
                        search.inputEl.removeClass('streams-folder-valid');
                        search.inputEl.removeClass('streams-folder-invalid');
                        
                        if (value === '') {
                            // Empty input, no styling needed
                        } else if (pathExists) {
                            search.inputEl.addClass('streams-folder-valid');
                        } else {
                            search.inputEl.addClass('streams-folder-invalid');
                        }
                        
                        // Update stream folder immediately
                        stream.folder = normalizedPath;
                        await this.plugin.saveSettings();
                    });

                // Add folder suggestions
                new FolderSuggest(this.app, search.inputEl);
            });

        card.createEl('h4', { text: 'Ribbon controls', cls: 'streams-setting-header' });

        new Setting(card)
            .setName('Open today in ribbon')
            .setDesc('Show the "Open Today" button in the sidebar ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayInRibbon)
                .onChange(async (value) => {
                    stream.showTodayInRibbon = value;
                    this.plugin.updateStreamTodayIcon(stream);
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Today icon')
            .setDesc('Icon for the "Open Today" ribbon button')
            .setClass('streams-setting-indent')
            .addDropdown(dropdown => {
                this.populateIconDropdown(dropdown);
                dropdown
                    .setValue(stream.icon)
                    .onChange(async (value: LucideIcon) => {
                        stream.icon = value;
                        await this.plugin.saveSettings(true);
                    });
            });

        new Setting(card)
            .setName('Show today border')
            .setDesc('Display a colored border on the left side of the Today icon')
            .setClass('streams-setting-indent')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayBorder ?? true)
                .onChange(async (value) => {
                    stream.showTodayBorder = value;
                    this.plugin.updateStreamTodayIcon(stream);
                    await this.plugin.saveSettings();
                    
                    this.display();
                }));

        if (stream.showTodayBorder) {
            new Setting(card)
                .setName('Border color')
                .setClass('streams-setting-double-indent')
                .addText(text => text
                    .setValue(stream.todayBorderColor ?? 'var(--text-accent)')
                    .setPlaceholder('var(--text-accent)')
                    .onChange(async (value) => {
                        stream.todayBorderColor = value;
                    })
                    .then(textComponent => {
                        textComponent.inputEl.addEventListener('blur', async () => {
                            this.plugin.updateStreamTodayIcon(stream);
                            await this.plugin.saveSettings();
                        });
                    }));
        }

        new Setting(card)
            .setName('View full stream in ribbon')
            .setDesc('Show the "View Full Stream" button in the sidebar ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showFullStreamInRibbon)
                .onChange(async (value) => {
                    stream.showFullStreamInRibbon = value;
                    this.plugin.updateStreamViewIcon(stream);
                    await this.plugin.saveSettings();
                }));
                
        new Setting(card)
            .setName('View icon')
            .setDesc('Icon for the "View Full Stream" ribbon button')
            .setClass('streams-setting-indent')
            .addDropdown(dropdown => {
                this.populateIconDropdown(dropdown);
                dropdown
                    .setValue(stream.viewIcon || stream.icon)
                    .onChange(async (value: LucideIcon) => {
                        stream.viewIcon = value;
                        await this.plugin.saveSettings(true);
                    });
            });

        new Setting(card)
            .setName('Show view border')
            .setDesc('Display a colored border on the left side of the View icon')
            .setClass('streams-setting-indent')
            .addToggle(toggle => toggle
                .setValue(stream.showViewBorder ?? true)
                .onChange(async (value) => {
                    stream.showViewBorder = value;
                    this.plugin.updateStreamViewIcon(stream);
                    await this.plugin.saveSettings();
                    
                    this.display();
                }));

        if (stream.showViewBorder) {
            new Setting(card)
                .setName('Border color')
                .setClass('streams-setting-double-indent')
                .addText(text => text
                    .setValue(stream.viewBorderColor ?? 'var(--text-success)')
                    .setPlaceholder('var(--text-success)')
                    .onChange(async (value) => {
                        stream.viewBorderColor = value;
                    })
                    .then(textComponent => {
                        textComponent.inputEl.addEventListener('blur', async () => {
                            this.plugin.updateStreamViewIcon(stream);
                            await this.plugin.saveSettings();
                        });
                    }));
        }

        new Setting(card)
            .setName('Add command: open today')
            .setDesc('Add this stream to the command palette')
            .addToggle(toggle => toggle
                .setValue(stream.addCommand ?? false)
                .onChange(async (value) => {
                    stream.addCommand = value;
                    this.plugin.toggleStreamCommand(stream);
                    
                    if (value) {
                        setTimeout(() => {
                            this.plugin.initializeStreamCommands();
                            new Notice(`Added "${stream.name}, today" to command palette`);
                        }, 100);
                    }
                    
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Add command: view full stream')
            .setDesc('Add a view command to the command palette')
            .addToggle(toggle => toggle
                .setValue(stream.addViewCommand ?? false)
                .onChange(async (value) => {
                    stream.addViewCommand = value;
                    this.plugin.toggleStreamViewCommand(stream);
                    
                    if (value) {
                        setTimeout(() => {
                            this.plugin.initializeStreamCommands();
                            new Notice(`Added "${stream.name}, full stream" to command palette`);
                        }, 100);
                    }
                    
                    await this.plugin.saveSettings();
                }));

        new Setting(card)
            .setName('Delete stream')
            .setDesc('Permanently remove this stream')
            .addButton(button => button
                .setButtonText('Delete')
                .setWarning()
                .onClick(async () => {
                    this.plugin.log.debug(`Deleting stream ${stream.id} (${stream.name})`);
                    
                    this.plugin.settings.streams.splice(index, 1);
                    
                    await this.plugin.saveSettings(true);
                    
                    this.plugin.removeStreamCommand(stream.id);
                    this.plugin.removeStreamViewCommand(stream.id);
                    
                    this.display();
                }));
    }

    private populateIconDropdown(dropdown: any) {
        const iconCategories = {
            'Files & documents': ['file-text', 'file', 'files', 'folder', 'book', 'notebook', 'diary'],
            'Communication': ['message-circle', 'message-square', 'mail', 'inbox', 'send'],
            'Time & planning': ['alarm-check', 'calendar', 'clock', 'timer', 'history'],
            'UI elements': ['home', 'settings', 'search', 'bookmark', 'star', 'heart', 'layout-dashboard'],
            'Content': ['text', 'edit', 'pencil', 'pen', 'list', 'check-square'],
            'Media': ['image', 'video', 'music', 'camera'],
            'Weather': ['sun', 'moon', 'cloud', 'umbrella'],
            'Misc': ['user', 'users', 'tag', 'flag', 'bookmark', 'link']
        } as const;

        Object.entries(iconCategories).forEach(([category, icons]) => {
            dropdown.addOption(`---${category}---`, category);
            icons.forEach(icon => dropdown.addOption(icon, icon));
        });
    }

    private async validateFolderPath(path: string): Promise<boolean> {
        if (!path) return false;
        
        try {
            const folder = this.app.vault.getAbstractFileByPath(path);
            const folderExists = folder instanceof TFolder;
            
            if (!folderExists) {
                const parentPath = path.split('/').slice(0, -1).join('/');
                if (parentPath) {
                    const parentFolder = this.app.vault.getAbstractFileByPath(parentPath);
                    return parentFolder instanceof TFolder;
                }
            }
            
            return folderExists;
        } catch (error) {
            this.plugin.log.error('Error validating folder path:', error);
            return false;
        }
    }
} 