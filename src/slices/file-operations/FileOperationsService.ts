import { App } from 'obsidian';
import { PluginAwareSliceService } from '../../shared/base-slice';
import { CommandService, ViewService } from '../../shared/interfaces';
import { CREATE_FILE_VIEW_TYPE } from '../../shared/constants';
import { OpenStreamDateCommand } from './OpenStreamDateCommand';
import { OpenTodayStreamCommand } from './OpenTodayStreamCommand';
import { OpenTodayCurrentStreamCommand } from './OpenTodayCurrentStreamCommand';
import { CreateFileView } from './CreateFileView';

export class FileOperationsService extends PluginAwareSliceService implements CommandService, ViewService {
    private registeredCommands: string[] = [];

    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.registerViews();
        this.registerCommands();

        this.initialized = true;
    }

    cleanup(): void {
        this.unregisterCommands();
        this.unregisterViews();
        this.initialized = false;
    }

    registerViews(): void {
        const plugin = this.getPlugin();
        
        plugin.registerView(
            CREATE_FILE_VIEW_TYPE,
            (leaf) => new CreateFileView(leaf, plugin.app, "", { 
                id: "", 
                name: "", 
                folder: "", 
                icon: "calendar", 
                showTodayInRibbon: false, 
                addCommand: false, 
            }, new Date())
        );
    }

    unregisterViews(): void {
    }

    registerCommands(): void {
        const plugin = this.getPlugin();
        
        plugin.addCommand({
            id: 'streams-open-today-current-stream',
            name: 'Open today for current stream',
            callback: () => {
                const command = new OpenTodayCurrentStreamCommand(
                    plugin.app, 
                    this.getStreams(), 
                    this.getSettings().reuseCurrentTab, 
                    plugin as any
                );
                command.execute();
            }
        });

        this.registeredCommands.push('streams-open-today-current-stream');
    }

    unregisterCommands(): void {
        this.registeredCommands = [];
    }

    async openStreamDate(stream: any, date: Date, reuseCurrentTab: boolean = false): Promise<void> {
        const command = new OpenStreamDateCommand(
            this.getPlugin().app,
            stream,
            date,
            reuseCurrentTab
        );
        await command.execute();
    }

    async openTodayStream(stream: any, reuseCurrentTab: boolean = false): Promise<void> {
        const command = new OpenTodayStreamCommand(
            this.getPlugin().app,
            stream,
            reuseCurrentTab
        );
        await command.execute();
    }

    private getStreams(): any[] {
        const plugin = this.getPlugin() as any;
        return plugin.settings?.streams || [];
    }

    private getSettings(): any {
        const plugin = this.getPlugin() as any;
        return plugin.settings || {};
    }
}
