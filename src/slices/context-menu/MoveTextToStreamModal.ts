import { App, Modal, Setting, TFile, MarkdownView, Notice } from 'obsidian';
import { Stream } from '../../shared/types';
import { centralizedLogger } from '../../shared/centralized-logger';

export interface MoveTextOptions {
    selectedText: string;
    sourceEditor: any;
    sourceView: any;
}

export class MoveTextToStreamModal extends Modal {
    private streams: Stream[];
    private selectedStream: Stream | null = null;
    private useToday: boolean = true;
    private selectedDate: string = new Date().toISOString().split('T')[0];
    private prependMode: boolean = false; // true = prepend, false = append
    private addDivider: boolean = true; // true = add --- divider, false = no divider
    private selectedText: string;
    private sourceEditor: any;
    private sourceView: any;
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
        this.selectedStream = streams.length > 0 ? streams[0] : null;
        this.selectedText = moveOptions.selectedText;
        this.sourceEditor = moveOptions.sourceEditor;
        this.sourceView = moveOptions.sourceView;
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
                });
            });

        // Date selection toggle
        new Setting(contentEl)
            .setName('Date Selection')
            .setDesc('Choose when to add the text')
            .addToggle(toggle => {
                toggle
                    .setValue(this.useToday)
                    .onChange(value => {
                        this.useToday = value;
                        this.updateDateSetting();
                    });
            })
            .addText(text => {
                text
                    .setValue('Today')
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
    }

    private createDateSetting(container: HTMLElement): void {
        this.dateSetting = new Setting(container)
            .setName('Custom Date')
            .setDesc('Select a specific date (future: calendar picker)')
            .addText(text => {
                text
                    .setValue(this.selectedDate)
                    .setPlaceholder('YYYY-MM-DD')
                    .onChange(value => {
                        this.selectedDate = value;
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

        this.dateSetting.settingEl.style.display = this.useToday ? 'none' : 'block';
    }

    private updateDateSetting(): void {
        if (this.dateSetting) {
            this.dateSetting.settingEl.style.display = this.useToday ? 'none' : 'block';
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

        if (!this.useToday && !this.selectedDate) {
            new Notice('Please select a date');
            return;
        }

        try {
            const targetDate = this.useToday ? 
                new Date().toISOString().split('T')[0] : 
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
