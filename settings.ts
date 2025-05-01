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
                        addViewCommand: false
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
            .setName('Stream Name')
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

        // ==================== TODAY TOGGLE SECTION ====================
        // Completely isolated container for today toggle
        const todaySection = card.createDiv({cls: 'ribbon-toggle-section today-toggle-section'});
        
        // Create heading for this section
        todaySection.createEl('h4', {text: 'Open Today in Ribbon', cls: 'toggle-section-heading'});
        
        // Create visual indicator of current state
        const todayStateIndicator = todaySection.createDiv({cls: 'toggle-state-indicator'});
        todayStateIndicator.setText(stream.showTodayInRibbon ? 'ENABLED' : 'DISABLED');
        todayStateIndicator.addClass(stream.showTodayInRibbon ? 'is-enabled' : 'is-disabled');
        
        // Create action buttons container
        const todayButtonContainer = todaySection.createDiv({cls: 'toggle-button-container'});
        
        // Enable button
        const enableTodayButton = todayButtonContainer.createEl('button', {
            text: 'Enable',
            cls: 'toggle-action-button enable-button ' + (stream.showTodayInRibbon ? 'is-active' : '')
        });
        
        // Disable button
        const disableTodayButton = todayButtonContainer.createEl('button', {
            text: 'Disable',
            cls: 'toggle-action-button disable-button ' + (!stream.showTodayInRibbon ? 'is-active' : '')
        });
        
        // Add event handlers with timeouts to prevent interference
        enableTodayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!stream.showTodayInRibbon) {
                console.log('ENABLING TODAY RIBBON');
                stream.showTodayInRibbon = true;
                
                // Update UI
                todayStateIndicator.setText('ENABLED');
                todayStateIndicator.removeClass('is-disabled');
                todayStateIndicator.addClass('is-enabled');
                enableTodayButton.addClass('is-active');
                disableTodayButton.removeClass('is-active');
                
                // Update the ribbon icon directly
                this.plugin.updateStreamTodayIcon(stream);
                
                // Save settings
                await this.plugin.saveSettings();
            }
        });
        
        disableTodayButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (stream.showTodayInRibbon) {
                console.log('DISABLING TODAY RIBBON');
                stream.showTodayInRibbon = false;
                
                // Update UI
                todayStateIndicator.setText('DISABLED');
                todayStateIndicator.removeClass('is-enabled');
                todayStateIndicator.addClass('is-disabled');
                disableTodayButton.addClass('is-active');
                enableTodayButton.removeClass('is-active');
                
                // Update the ribbon icon directly
                this.plugin.updateStreamTodayIcon(stream);
                
                // Save settings
                await this.plugin.saveSettings();
            }
        });
        
        // Add icon setting
        const iconSetting = new Setting(card);
        iconSetting
            .setName('Icon')
            .setDesc('Open Today ribbon button')
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
                        
                        // Save settings with UI refresh
                        await this.plugin.saveSettings(true);
                    });
            });
        
        // Add separator
        card.createEl('hr', {cls: 'settings-separator'});
        
        // ==================== VIEW TOGGLE SECTION ====================
        // Completely isolated container for view toggle
        const viewSection = card.createDiv({cls: 'ribbon-toggle-section view-toggle-section'});
        
        // Create heading for this section
        viewSection.createEl('h4', {text: 'View Full Stream in Ribbon', cls: 'toggle-section-heading'});
        
        // Create visual indicator of current state
        const viewStateIndicator = viewSection.createDiv({cls: 'toggle-state-indicator'});
        viewStateIndicator.setText(stream.showFullStreamInRibbon ? 'ENABLED' : 'DISABLED');
        viewStateIndicator.addClass(stream.showFullStreamInRibbon ? 'is-enabled' : 'is-disabled');
        
        // Create action buttons container
        const viewButtonContainer = viewSection.createDiv({cls: 'toggle-button-container'});
        
        // Enable button
        const enableViewButton = viewButtonContainer.createEl('button', {
            text: 'Enable',
            cls: 'toggle-action-button enable-button ' + (stream.showFullStreamInRibbon ? 'is-active' : '')
        });
        
        // Disable button
        const disableViewButton = viewButtonContainer.createEl('button', {
            text: 'Disable',
            cls: 'toggle-action-button disable-button ' + (!stream.showFullStreamInRibbon ? 'is-active' : '')
        });
        
        // Add event handlers with timeouts to prevent interference
        enableViewButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!stream.showFullStreamInRibbon) {
                console.log('ENABLING VIEW RIBBON');
                stream.showFullStreamInRibbon = true;
                
                // Update UI
                viewStateIndicator.setText('ENABLED');
                viewStateIndicator.removeClass('is-disabled');
                viewStateIndicator.addClass('is-enabled');
                enableViewButton.addClass('is-active');
                disableViewButton.removeClass('is-active');
                
                // Update the ribbon icon directly
                this.plugin.updateStreamViewIcon(stream);
                
                // Save settings
                await this.plugin.saveSettings();
            }
        });
        
        disableViewButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (stream.showFullStreamInRibbon) {
                console.log('DISABLING VIEW RIBBON');
                stream.showFullStreamInRibbon = false;
                
                // Update UI
                viewStateIndicator.setText('DISABLED');
                viewStateIndicator.removeClass('is-enabled');
                viewStateIndicator.addClass('is-disabled');
                disableViewButton.addClass('is-active');
                enableViewButton.removeClass('is-active');
                
                // Update the ribbon icon directly
                this.plugin.updateStreamViewIcon(stream);
                
                // Save settings
                await this.plugin.saveSettings();
            }
        });
        
        // Add View Icon setting
        const viewIconSetting = new Setting(card);
        viewIconSetting
            .setName('View Icon')
            .setDesc('View Full Stream ribbon button')
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
                    .setValue(stream.viewIcon || stream.icon)
                    .onChange(async (value: LucideIcon) => {
                        stream.viewIcon = value;
                        
                        // Save settings with UI refresh
                        await this.plugin.saveSettings(true);
                    });
            });

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

        new Setting(card)
            .addButton(button => button
                .setButtonText('Delete Stream')
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
} 