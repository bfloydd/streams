import { App, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { Stream } from './types';

export class CalendarWidget {
    private widget: HTMLElement;
    private expanded: boolean = false;
    private currentDate: Date = new Date();
    private selectedStream: Stream;
    private app: App;

    constructor(leaf: WorkspaceLeaf, stream: Stream, app: App) {
        console.log('Creating calendar widget for stream:', stream.name);
        this.selectedStream = stream;
        this.app = app;
        
        this.widget = document.createElement('div');
        this.widget.addClass('stream-calendar-widget');
        document.body.appendChild(this.widget);
        
        this.initializeWidget();
    }

    private initializeWidget() {
        // Create collapsed view
        const collapsedView = this.widget.createDiv('stream-calendar-collapsed');
        const todayButton = collapsedView.createDiv('stream-calendar-today-button');
        todayButton.setText(this.formatDate(new Date()));

        // Create expanded view
        const expandedView = this.widget.createDiv('stream-calendar-expanded');
        expandedView.style.display = 'none';

        // Create calendar header
        const header = expandedView.createDiv('stream-calendar-header');
        const prevButton = header.createDiv('stream-calendar-nav');
        prevButton.setText('←');
        const dateDisplay = header.createDiv('stream-calendar-date');
        dateDisplay.setText(this.formatMonthYear(this.currentDate));
        const nextButton = header.createDiv('stream-calendar-nav');
        nextButton.setText('→');

        // Create calendar grid
        const grid = expandedView.createDiv('stream-calendar-grid');
        this.updateCalendarGrid(grid);

        // Event listeners
        todayButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(collapsedView, expandedView);
        });

        prevButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            this.updateCalendarGrid(grid);
        });

        nextButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            dateDisplay.setText(this.formatMonthYear(this.currentDate));
            this.updateCalendarGrid(grid);
        });

        document.addEventListener('click', (e) => {
            if (this.expanded && !this.widget.contains(e.target as Node)) {
                this.toggleExpanded(collapsedView, expandedView);
            }
        });
    }

    private updateCalendarGrid(grid: HTMLElement) {
        grid.empty();

        // Add day headers
        const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        days.forEach(day => {
            const dayHeader = grid.createDiv('calendar-day-header');
            dayHeader.setText(day);
        });

        // Get first day of month and total days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const totalDays = lastDay.getDate();
        const startingDay = firstDay.getDay();

        // Add blank spaces for days before start of month
        for (let i = 0; i < startingDay; i++) {
            grid.createDiv('calendar-day empty');
        }

        // Add days of month
        for (let day = 1; day <= totalDays; day++) {
            const dayEl = grid.createDiv('calendar-day');
            dayEl.setText(String(day));
            
            if (this.isToday(day)) {
                dayEl.addClass('today');
            }
            
            dayEl.addEventListener('click', () => {
                this.selectDate(day);
            });
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    private formatMonthYear(date: Date): string {
        return date.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }

    private isToday(day: number): boolean {
        const today = new Date();
        return day === today.getDate() && 
               this.currentDate.getMonth() === today.getMonth() && 
               this.currentDate.getFullYear() === today.getFullYear();
    }

    private async selectDate(day: number) {
        // Format the selected date as YYYY-MM-DD
        const selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const fileName = `${year}-${month}-${dayStr}.md`;

        // Construct the full file path using the stream's folder
        const folderPath = this.selectedStream.folder
            .split(/[/\\]/)
            .filter(Boolean)
            .join('/');
        const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

        // Try to find existing file or create new one
        let file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file) {
            // Create folder if needed
            if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }
            file = await this.app.vault.create(filePath, '');
        }

        if (file instanceof TFile) {
            // Check if file is already open in a tab
            const existingLeaf = this.app.workspace.getLeavesOfType('markdown')
                .find(leaf => (leaf.view as MarkdownView).file?.path === file.path);

            if (existingLeaf) {
                // Switch to existing tab
                this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
            } else {
                // Open in new tab
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(file);
                this.app.workspace.setActiveLeaf(leaf, { focus: true });
            }
        }
    }

    private toggleExpanded(collapsedView: HTMLElement, expandedView: HTMLElement) {
        this.expanded = !this.expanded;
        expandedView.style.display = this.expanded ? 'block' : 'none';
        collapsedView.toggleClass('today-button-expanded', this.expanded);
        expandedView.toggleClass('calendar-expanded', this.expanded);
    }

    public destroy() {
        console.log('Destroying calendar widget');
        this.widget?.remove();
    }
} 