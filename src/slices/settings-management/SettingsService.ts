import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { SettingsAwareSliceService } from '../../shared/base-slice';
import { Stream, StreamsSettings, LucideIcon } from '../../shared/types';
import { StreamsPluginInterface } from '../../shared/interfaces';
import { eventBus, EVENTS } from '../../shared/event-bus';
import { centralizedLogger } from '../../shared/centralized-logger';

export class SettingsService extends SettingsAwareSliceService {
    private settingsTab: StreamsSettingTab | null = null;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.settingsTab = new StreamsSettingTab(this.getPlugin().app, this.getPlugin() as any);
        this.getPlugin().addSettingTab(this.settingsTab);

        this.initialized = true;
    }

    cleanup(): void {
        this.settingsTab = null;
        this.initialized = false;
    }

    onSettingsChanged(settings: StreamsSettings): void {
        this.notifySettingsChanged(settings);
    }

    private notifySettingsChanged(settings: StreamsSettings): void {
        centralizedLogger.info('Settings changed');
    }

    getSettings(): StreamsSettings {
        return super.getSettings();
    }

    async saveSettings(): Promise<void> {
        await super.saveSettings();
    }
}

export class StreamsSettingTab extends PluginSettingTab {
    plugin: StreamsPluginInterface;

    constructor(app: App, plugin: StreamsPluginInterface) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Show streams bar component')
            .setDesc('Show the streams bar component on all notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showStreamsBarComponent)
                .onChange(async (value) => {
                    this.plugin.settings.showStreamsBarComponent = value;
                    await this.plugin.saveSettings();
                    
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    
                    new Notice(`Streams bar component ${value ? 'shown' : 'hidden'}`);
                }));
                
        new Setting(containerEl)
            .setName('Reuse current tab for calendar navigation')
            .setDesc('When enabled, calendar navigation will reuse the current tab instead of opening new tabs')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.reuseCurrentTab)
                .onChange(async (value) => {
                    this.plugin.settings.reuseCurrentTab = value;
                    await this.plugin.saveSettings();
                    
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    
                    new Notice(`Calendar navigation will ${value ? 'reuse' : 'open new'} tabs`);
                }));
                
        new Setting(containerEl)
            .setName('Enable debug logging')
            .setDesc('Enable debug logging for the Streams plugin (can also be toggled via command palette)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugLoggingEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.debugLoggingEnabled = value;
                    
                    if (value) {
                        this.plugin.log.on();
                    } else {
                        this.plugin.log.off();
                    }
                    
                    await this.plugin.saveSettings();
                    
                    new Notice(`Debug logging ${value ? 'enabled' : 'disabled'}`);
                }));
                
        new Setting(containerEl)
            .setName('Bar style')
            .setDesc('Choose the visual style for the streams bar component')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'Default')
                .addOption('modern', 'Modern')
                .setValue(this.plugin.settings.barStyle)
                .onChange(async (value: 'default' | 'modern') => {
                    this.plugin.settings.barStyle = value;
                    await this.plugin.saveSettings();
                    
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    
                    new Notice(`Bar style changed to ${value === 'default' ? 'Default' : 'Modern'}`);
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
                        showTodayInRibbon: true,
                        addCommand: false,
                        encryptThisStream: false,
                        disabled: false
                    };
                    this.plugin.settings.streams.push(newStream);
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
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
        
        // Add disabled class if stream is disabled
        if (stream.disabled) {
            card.addClass('streams-plugin-card-disabled');
        }
        
        // Create header with title and reorder controls
        const header = card.createDiv('streams-card-header');
        const title = header.createEl('h3', { text: stream.name });
        
        // Add reorder controls to the header
        const reorderContainer = header.createDiv('streams-reorder-container');
        reorderContainer.style.display = 'flex';
        reorderContainer.style.gap = '0.25em';
        reorderContainer.style.marginLeft = 'auto';
        
        // Move up button - create simple HTML button
        const upButton = reorderContainer.createEl('button', {
            cls: 'streams-reorder-btn streams-caret-up',
            attr: {
                'data-action': 'move-up',
                'title': 'Move stream up'
            }
        });
        if (index === 0) upButton.disabled = true;
        upButton.addEventListener('click', async () => {
            await this.moveStreamUp(index);
        });

        // Move down button - create simple HTML button
        const downButton = reorderContainer.createEl('button', {
            cls: 'streams-reorder-btn streams-caret-down',
            attr: {
                'data-action': 'move-down',
                'title': 'Move stream down'
            }
        });
        if (index === this.plugin.settings.streams.length - 1) downButton.disabled = true;
        downButton.addEventListener('click', async () => {
            await this.moveStreamDown(index);
        });
        
        return card;
    }

    private addStreamSettings(container: HTMLElement, stream: Stream, index: number): void {
        // Stream name
        new Setting(container)
            .setName('Stream name')
            .setDesc('Name of the stream')
            .addText(text => text
                .setValue(stream.name)
                .onChange(async (value) => {
                    stream.name = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Stream folder
        new Setting(container)
            .setName('Folder')
            .setDesc('Folder where daily notes will be created')
            .addText(text => text
                .setValue(stream.folder)
                .onChange(async (value) => {
                    stream.folder = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Show today in ribbon
        new Setting(container)
            .setName('Show today button in ribbon')
            .setDesc('Show a today button for this stream in the ribbon')
            .addToggle(toggle => toggle
                .setValue(stream.showTodayInRibbon)
                .onChange(async (value) => {
                    stream.showTodayInRibbon = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Add command
        new Setting(container)
            .setName('Add command')
            .setDesc('Add a command for this stream')
            .addToggle(toggle => toggle
                .setValue(stream.addCommand)
                .onChange(async (value) => {
                    stream.addCommand = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                }));

        // Encrypt this stream
        this.addEncryptionToggle(container, stream);

        // Disable stream
        const disableSetting = new Setting(container)
            .setName('Disable stream')
            .setDesc('When disabled, this stream will be hidden from selection lists and grayed out in settings')
            .addToggle(toggle => toggle
                .setValue(stream.disabled || false)
                .onChange(async (value) => {
                    stream.disabled = value;
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    
                    // Refresh the display to update visual styling
                    this.display();
                }));
        
        // Add a class to identify the disable toggle for styling
        if (stream.disabled) {
            disableSetting.settingEl.addClass('streams-disable-toggle');
        }

        // Remove stream
        new Setting(container)
            .addButton(button => button
                .setButtonText('Remove stream')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings.streams.splice(index, 1);
                    await this.plugin.saveSettings();
                    eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                    this.display();
                }));
    }

    private async moveStreamUp(index: number): Promise<void> {
        if (index === 0) return;
        
        const streams = this.plugin.settings.streams;
        const stream = streams[index];
        
        // Remove stream from current position
        streams.splice(index, 1);
        
        // Insert stream at new position (one position up)
        streams.splice(index - 1, 0, stream);
        
        await this.plugin.saveSettings();
        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
        this.display();
    }

    private async moveStreamDown(index: number): Promise<void> {
        const streams = this.plugin.settings.streams;
        if (index === streams.length - 1) return;
        
        const stream = streams[index];
        
        // Remove stream from current position
        streams.splice(index, 1);
        
        // Insert stream at new position (one position down)
        streams.splice(index + 1, 0, stream);
        
        await this.plugin.saveSettings();
        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
        this.display();
    }

    private addEncryptionToggle(container: HTMLElement, stream: Stream): void {
        // Check if Meld plugin is available
        const fileOpsService = this.plugin.getFileOperationsService?.();
        const isMeldAvailable = fileOpsService?.isMeldPluginAvailable() || false;
        
        const encryptionSetting = new Setting(container)
            .setName('Encrypt this stream')
            .setDesc(isMeldAvailable 
                ? 'When enabled, files created in this stream will be encrypted using the Meld plugin'
                : 'Meld plugin is not available. Please install and enable the Meld plugin to use encryption features.'
            )
            .addToggle(toggle => {
                toggle
                    .setValue(stream.encryptThisStream || false)
                    .setDisabled(!isMeldAvailable)
                    .onChange(async (value) => {
                        if (value && !isMeldAvailable) {
                            new Notice('Meld plugin is not available. Please install and enable the Meld plugin first.');
                            return;
                        }
                        
                        stream.encryptThisStream = value;
                        await this.plugin.saveSettings();
                        eventBus.emit(EVENTS.SETTINGS_CHANGED, this.plugin.settings, 'settings-management');
                        
                        new Notice(`Encryption ${value ? 'enabled' : 'disabled'} for stream "${stream.name}"`);
                    });
            });

        // Add warning if Meld is not available
        if (!isMeldAvailable) {
            const warningEl = container.createDiv('streams-encryption-warning');
            warningEl.style.color = 'var(--text-error)';
            warningEl.style.fontSize = '0.9em';
            warningEl.style.marginTop = '0.5em';
            warningEl.textContent = '⚠️ Meld plugin is required for encryption features';
        }
    }
}
