import { App, PluginSettingTab, Setting, Notice, TFolder } from 'obsidian';
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
                .onChange(async (value) => {
                    const normalizedPath = value.split(/[/\\]/).filter(Boolean).join('/');
                    stream.folder = normalizedPath;
                    
                    // Validate path
                    const pathExists = await this.validateFolderPath(normalizedPath);
                    
                    // Remove existing validation classes
                    text.inputEl.removeClass('stream-folder-valid');
                    text.inputEl.removeClass('stream-folder-invalid');
                    
                    // Update input styling based on validation
                    if (value === '') {
                        // Reset to default styling for empty input
                        // No class needed
                    } else if (pathExists) {
                        // Valid path - add valid class
                        text.inputEl.addClass('stream-folder-valid');
                    } else {
                        // Invalid path - add invalid class
                        text.inputEl.addClass('stream-folder-invalid');
                    }
                    
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
                    
                    // Force commands to re-register if enabling
                    if (value) {
                        // Small delay to ensure the command is properly registered
                        setTimeout(() => {
                            this.plugin.initializeStreamCommands();
                            // Show a notice to confirm the command was added
                            new Notice(`Added "${stream.name}, Today" to command palette`);
                        }, 100);
                    }
                    
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
                    
                    // Force commands to re-register if enabling
                    if (value) {
                        // Small delay to ensure the command is properly registered
                        setTimeout(() => {
                            this.plugin.initializeStreamCommands();
                            // Show a notice to confirm the command was added
                            new Notice(`Added "${stream.name}, Full Stream" to command palette`);
                        }, 100);
                    }
                    
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

    private async validateFolderPath(path: string): Promise<boolean> {
        if (!path) return false;
        
        try {
            // Check if the folder exists in the vault
            const folder = this.app.vault.getAbstractFileByPath(path);
            const folderExists = folder instanceof TFolder;
            
            // If it's not found directly, check if a parent folder exists that we can potentially create this in
            if (!folderExists) {
                // Try parent path
                const parentPath = path.split('/').slice(0, -1).join('/');
                if (parentPath) {
                    const parentFolder = this.app.vault.getAbstractFileByPath(parentPath);
                    return parentFolder instanceof TFolder;
                }
            }
            
            return folderExists;
        } catch (error) {
            console.error('Error validating folder path:', error);
            return false;
        }
    }
} 