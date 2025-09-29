import { EventBus } from './event-bus';

export interface DateState {
    currentDate: Date;
    currentViewedDate: string; // YYYY-MM-DD format
    isNavigating: boolean;
}

export class DateStateManager {
    private static instance: DateStateManager;
    private state: DateState;
    private eventBus: EventBus;

    private constructor() {
        this.eventBus = new EventBus();
        this.state = {
            currentDate: new Date(),
            currentViewedDate: this.formatDateString(new Date()),
            isNavigating: false
        };
    }

    public static getInstance(): DateStateManager {
        if (!DateStateManager.instance) {
            DateStateManager.instance = new DateStateManager();
        }
        return DateStateManager.instance;
    }

    public getState(): DateState {
        return { ...this.state };
    }

    public setCurrentDate(date: Date): void {
        this.state.currentDate = new Date(date);
        this.state.currentViewedDate = this.formatDateString(date);
        this.state.isNavigating = true;
        
        this.eventBus.emit('date-changed', this.state, 'DateStateManager');
        
        // Reset navigating flag after a short delay
        setTimeout(() => {
            this.state.isNavigating = false;
        }, 100);
    }

    public setCurrentViewedDate(dateString: string): void {
        const [year, month, day] = dateString.split('-').map(n => parseInt(n, 10));
        const date = new Date(year, month - 1, day);
        
        this.state.currentDate = date;
        this.state.currentViewedDate = dateString;
        this.state.isNavigating = true;
        
        this.eventBus.emit('date-changed', this.state, 'DateStateManager');
        
        // Reset navigating flag after a short delay
        setTimeout(() => {
            this.state.isNavigating = false;
        }, 100);
    }

    public navigateToAdjacentDay(offset: number): void {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() + offset);
        this.setCurrentDate(newDate);
    }

    public navigateToToday(): void {
        this.setCurrentDate(new Date());
    }

    public onDateChanged(callback: (state: DateState) => void): () => void {
        return this.eventBus.subscribe('date-changed', (event) => {
            if (event.data && typeof event.data === 'object') {
                callback(event.data as DateState);
            }
        });
    }

    private formatDateString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
