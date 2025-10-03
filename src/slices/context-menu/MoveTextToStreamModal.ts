import { App, Modal, Setting, TFile, MarkdownView, Notice } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';
import { ModalStateManager } from '../../shared/modal-state-manager';

export interface MoveTextOptions {
    selectedText: string;
    sourceEditor: any;
    sourceView: any;
}

export class MoveTextToStreamModal extends Modal {
    private streams: Stream[];
    private selectedStream: Stream | null = null;
    private useSourceDate: boolean = true; // true = source date, false = today
    private selectedDate: string = new Date().toISOString().split('T')[0];
    private sourceDate: string = new Date().toISOString().split('T')[0];
    private prependMode: boolean = false; // true = prepend, false = append
    private addDivider: boolean = true; // true = add --- divider, false = no divider
    private selectedText: string;
    private sourceEditor: any;
    private sourceView: any;
    private toggleTextInput: HTMLInputElement | null = null;
    private stateManager: ModalStateManager;
    private onMove: (options: {
        stream: Stream;
        date: string;
        prepend: boolean;
        addDivider: boolean;
        text: string;
        sourceEditor: any;
        sourceView: any;
    }) => Promise<void>;

    constructor(
        app: App,
        streams: Stream[],
        moveOptions: MoveTextOptions,
        onMove: (options: {
            stream: Stream;
            date: string;
            prepend: boolean;
            addDivider: boolean;
            text: string;
            sourceEditor: any;
            sourceView: any;
        }) => Promise<void>
    ) {
        super(app);
        this.streams = streams;
        this.onMove = onMove;
        this.selectedText = moveOptions.selectedText;
        this.sourceEditor = moveOptions.sourceEditor;
        this.sourceView = moveOptions.sourceView;
        this.stateManager = ModalStateManager.getInstance();
        
        // Extract date from source document
        this.sourceDate = this.extractDateFromSourceDocument();
        
        // Load settings from temporary state
        this.loadSettingsFromState();
    }

    private extractDateFromSourceDocument(): string {
        if (!this.sourceView || !this.sourceView.file) {
            return new Date().toISOString().split('T')[0];
        }
        
        const fileName = this.sourceView.file.basename;
        const match = fileName.match(/^\d{4}-\d{2}-\d{2}/);
        
        if (match) {
            return match[0];
        }
        
        // If no date found in filename, return today's date
        return new Date().toISOString().split('T')[0];
    }

    private loadSettingsFromState(): void {
        const state = this.stateManager.getState();
        
        // Load selected stream
        if (state.selectedStreamId) {
            this.selectedStream = this.streams.find(s => s.id === state.selectedStreamId) || null;
        } else {
            this.selectedStream = this.streams.length > 0 ? this.streams[0] : null;
        }
        
        // Load other settings
        this.useSourceDate = state.useSourceDate;
        this.selectedDate = state.selectedDate;
        this.prependMode = state.prependMode;
        this.addDivider = state.addDivider;
    }

    private saveSettingsToState(): void {
        this.stateManager.updateState({
            selectedStreamId: this.selectedStream?.id || null,
            useSourceDate: this.useSourceDate,
            selectedDate: this.selectedDate,
            prependMode: this.prependMode,
            addDivider: this.addDivider
        });
    }

    private updateTextDisplays(): void {
        // Update date selection text
        if (this.toggleTextInput) {
            this.toggleTextInput.value = this.useSourceDate ? `Source Date (${this.sourceDate})` : 'Calendar Select';
        }
        
        // Update text position text
        const textPositionElements = this.contentEl.querySelectorAll('.setting-item');
        textPositionElements.forEach(element => {
            const nameEl = element.querySelector('.setting-item-name');
            if (nameEl && nameEl.textContent === 'Text Position') {
                const textInput = element.querySelector('input[type="text"]') as HTMLInputElement;
                if (textInput) {
                    textInput.value = this.prependMode ? 'Prepend (add to top)' : 'Append (add to bottom)';
                }
            }
        });
        
        // Update divider text
        textPositionElements.forEach(element => {
            const nameEl = element.querySelector('.setting-item-name');
            if (nameEl && nameEl.textContent === 'Add Divider') {
                const textInput = element.querySelector('input[type="text"]') as HTMLInputElement;
                if (textInput) {
                    textInput.value = this.addDivider ? 'Add --- separator' : 'No separator';
                }
            }
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl('h2', { text: 'Move Text to Stream' });

        // Stream selection
        new Setting(contentEl)
            .setName('Target Stream')
            .setDesc('Select the stream to move the text to')
            .addDropdown(dropdown => {
                this.streams.forEach(stream => {
                    dropdown.addOption(stream.id, stream.name);
                });
                
                if (this.selectedStream) {
                    dropdown.setValue(this.selectedStream.id);
                }
                
                dropdown.onChange(value => {
                    this.selectedStream = this.streams.find(s => s.id === value) || null;
                    this.saveSettingsToState();
                });
            });

        // Date selection toggle
        new Setting(contentEl)
            .setName('Date Selection')
            .setDesc('Choose when to add the text')
            .addToggle(toggle => {
                toggle
                    .setValue(!this.useSourceDate)
                    .onChange(value => {
                        this.useSourceDate = !value;
                        this.updateDateSetting();
                        this.saveSettingsToState();
                        this.updateTextDisplays();
                    });
            })
            .addText(text => {
                this.toggleTextInput = text.inputEl;
                text
                    .setValue(this.useSourceDate ? `Source Date (${this.sourceDate})` : 'Calendar Select')
                    .setDisabled(true);
            });

        // Custom date setting (stubbed for future calendar implementation)
        this.createDateSetting(contentEl);

        // Prepend/Append toggle
        new Setting(contentEl)
            .setName('Text Position')
            .setDesc('Choose where to place the text in the target file')
            .addToggle(toggle => {
                toggle
                    .setValue(this.prependMode)
                    .onChange(value => {
                        this.prependMode = value;
                        this.saveSettingsToState();
                        this.updateTextDisplays();
                    });
            })
            .addText(text => {
                text
                    .setValue(this.prependMode ? 'Prepend (add to top)' : 'Append (add to bottom)')
                    .setDisabled(true);
            });

        // Divider toggle
        new Setting(contentEl)
            .setName('Add Divider')
            .setDesc('Add --- separator around the moved text')
            .addToggle(toggle => {
                toggle
                    .setValue(this.addDivider)
                    .onChange(value => {
                        this.addDivider = value;
                        this.saveSettingsToState();
                        this.updateTextDisplays();
                    });
            })
            .addText(text => {
                text
                    .setValue(this.addDivider ? 'Add --- separator' : 'No separator')
                    .setDisabled(true);
            });


        // Action buttons
        const buttonContainer = contentEl.createEl('div', {
            cls: 'move-text-buttons'
        });

        const moveButton = buttonContainer.createEl('button', {
            text: 'Move Text',
            cls: 'mod-cta'
        });

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'mod-secondary'
        });

        // Event handlers
        moveButton.addEventListener('click', async () => {
            await this.handleMove();
        });

        cancelButton.addEventListener('click', () => {
            this.close();
        });

        // Update date setting initially
        this.updateDateSetting();
        
        // Update text displays to reflect current state
        this.updateTextDisplays();
    }

    private createDateSetting(container: HTMLElement): void {
        this.dateSetting = new Setting(container)
            .setName('Calendar Select')
            .setDesc('Select a specific date')
            .addText(text => {
                text
                    .setValue(this.selectedDate)
                    .setPlaceholder('YYYY-MM-DD')
                    .onChange(value => {
                        this.selectedDate = value;
                        this.saveSettingsToState();
                    });
            })
            .addButton(button => {
                button
                    .setButtonText('📅')
                    .setTooltip('Open calendar picker (coming soon)')
                    .onClick(() => {
                        // TODO: Implement calendar picker
                        this.showCalendarStub();
                    });
            });

        this.dateSetting.settingEl.style.display = this.useSourceDate ? 'none' : 'block';
    }

    private updateDateSetting(): void {
        if (this.dateSetting) {
            this.dateSetting.settingEl.style.display = this.useSourceDate ? 'none' : 'block';
        }
        
        // Update the toggle text label
        if (this.toggleTextInput) {
            this.toggleTextInput.value = this.useSourceDate ? `Source Date (${this.sourceDate})` : 'Calendar Select';
        }
    }

    private showCalendarStub(): void {
        // TODO: Implement calendar picker
        // For now, just show a notice
        new Notice('Calendar picker coming soon!');
    }

    private getSelectedText(): string {
        return this.selectedText;
    }

    private async handleMove(): Promise<void> {
        if (!this.selectedStream) {
            new Notice('Please select a stream');
            return;
        }

        if (!this.useSourceDate && !this.selectedDate) {
            new Notice('Please select a date');
            return;
        }

        try {
            const targetDate = this.useSourceDate ? 
                this.sourceDate : 
                this.selectedDate;

            await this.onMove({
                stream: this.selectedStream,
                date: targetDate,
                prepend: this.prependMode,
                addDivider: this.addDivider,
                text: this.getSelectedText(),
                sourceEditor: this.sourceEditor,
                sourceView: this.sourceView
            });

            this.close();
        } catch (error) {
            centralizedLogger.error('Error moving text to stream:', error);
            new Notice('Failed to move text to stream');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private dateSetting: Setting | null = null;
}
