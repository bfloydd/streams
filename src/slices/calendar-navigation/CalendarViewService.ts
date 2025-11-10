import { CalendarViewChecker } from '../../shared/interfaces';

/**
 * Service for determining which view types should have calendar components
 * Follows Single Responsibility Principle - only handles calendar view logic
 */
export class CalendarViewService implements CalendarViewChecker {
    /**
     * Check if a view type should have a calendar component
     */
    shouldCreateCalendarForViewType(viewType: string): boolean {
        return viewType === 'empty' ||
               viewType === 'file-explorer' ||
               viewType === 'search' ||
               viewType === 'graph' ||
               viewType === 'markdown' ||
               viewType === 'streams-install-meld-view' ||
               viewType === 'streams-create-file-view-encrypted';
    }
}