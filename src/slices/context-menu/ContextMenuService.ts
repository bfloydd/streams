import { PluginAwareSliceService } from '../../shared/base-slice';
import { StreamManagementService } from '../stream-management/StreamManagementService';
import { centralizedLogger } from '../../shared/centralized-logger';
import { MoveTextToStreamModal, MoveTextOptions } from './MoveTextToStreamModal';
import { MarkdownView, Notice, Menu, Editor, TFile, TAbstractFile } from 'obsidian';
import { Stream } from '../../shared/types';

export class ContextMenuService extends PluginAwareSliceService {
    private registeredEvents: Array<() => void> = [];

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.registerEditorContextMenu();
        this.registerFileContextMenu();
        this.initialized = true;
    }

    cleanup(): void {
        this.registeredEvents.forEach(unregister => unregister());
        this.registeredEvents = [];
        this.initialized = false;
    }

    private registerEditorContextMenu(): void {
        const plugin = this.getPlugin();
        
        const unregister = plugin.registerEvent(
            plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
                const selectedText = editor.getSelection();
                
                if (selectedText && this.hasStreams()) {
                    this.addMoveTextMenuItem(menu, selectedText, editor);
                }
            })
        ) as unknown as () => void;
        
        this.registeredEvents.push(unregister);
    }

    private registerFileContextMenu(): void {
        // File context menu functionality removed as requested
    }


    private addMoveTextMenuItem(menu: Menu, selectedText: string, editor: Editor): void {
        menu.addItem((item) => {
            item
                .setTitle('Move selected text to stream')
                .setIcon('arrow-right')
                .onClick(async () => {
                    await this.showMoveTextModal(selectedText, editor);
                });
        });
    }


    private hasStreams(): boolean {
        return this.getStreams().length > 0;
    }

    private async showMoveTextModal(selectedText: string, editor: Editor): Promise<void> {
        const streams = this.getStreams();
        if (streams.length === 0) {
            new Notice('No streams available');
            return;
        }

        const moveOptions: MoveTextOptions = {
            selectedText,
            sourceEditor: editor,
            sourceView: this.getPlugin().app.workspace.getActiveViewOfType(MarkdownView)
        };

        const modal = new MoveTextToStreamModal(
            this.getPlugin().app,
            streams,
            moveOptions,
            (options) => this.moveTextToStream(options)
        );

        modal.open();
    }

    private async moveTextToStream(options: {
        stream: Stream;
        date: string;
        prepend: boolean;
        addDivider: boolean;
        text: string;
        sourceEditor: Editor;
        sourceView: MarkdownView | null;
    }): Promise<void> {
        try {
            const { stream, date, prepend, addDivider, text, sourceEditor } = options;
            
            const fileName = `${date}.md`;
            const filePath = `${stream.folder}/${fileName}`;
            
            let targetFile = this.getPlugin().app.vault.getAbstractFileByPath(filePath);
            let targetContent = '';
            
            if (targetFile) {
                targetContent = await this.getPlugin().app.vault.read(targetFile as TFile);
            } else {
                targetContent = `# ${date}\n\n`;
                targetFile = await this.getPlugin().app.vault.create(filePath, targetContent);
            }
            
            const textToAdd = this.prepareTextToAdd(text, addDivider, prepend);
            const newContent = this.insertTextIntoContent(targetContent, textToAdd, prepend);
            
            await this.getPlugin().app.vault.modify(targetFile as TFile, newContent);
            
            if (sourceEditor.getSelection() === text) {
                sourceEditor.replaceSelection('');
            }
            
            new Notice(`Text moved to ${stream.name} (${date})`);
            
        } catch (error) {
            centralizedLogger.error('Error moving text to stream:', error);
            throw error;
        }
    }

    private prepareTextToAdd(text: string, addDivider: boolean, prepend: boolean): string {
        if (!addDivider) {
            return `\n\n${text}\n`;
        }
        
        return prepend 
            ? `\n\n${text}\n\n---\n`
            : `\n\n---\n\n${text}\n`;
    }

    private insertTextIntoContent(content: string, textToAdd: string, prepend: boolean): string {
        if (!prepend) {
            return content + textToAdd;
        }
        
        const headingMatch = content.match(/^# .+$/m);
        if (headingMatch) {
            const insertIndex = headingMatch.index! + headingMatch[0].length;
            return content.slice(0, insertIndex) + textToAdd + content.slice(insertIndex);
        }
        
        return textToAdd + content;
    }

    private getStreams(): Stream[] {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams || [];
    }

    private getStreamService(): StreamManagementService | null {
        return this.getService('stream-management') as StreamManagementService | null;
    }

    private getService(serviceName: string): unknown {
        const container = (this.getPlugin() as any).sliceContainer;
        return container?.get(serviceName);
    }
}
