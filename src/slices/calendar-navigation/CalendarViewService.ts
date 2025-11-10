import { CalendarViewChecker } from '../../shared/interfaces';
import { CALENDAR_ENABLED_VIEW_TYPES } from '../../shared/constants';

/**
 * Service for determining which view types should have calendar components
 * Follows Single Responsibility Principle - only handles calendar view logic
 */
export class CalendarViewService implements CalendarViewChecker {
    /**
     * Check if a view type should have a calendar component
     */
    shouldCreateCalendarForViewType(viewType: string): boolean {
        return CALENDAR_ENABLED_VIEW_TYPES.includes(viewType as typeof CALENDAR_ENABLED_VIEW_TYPES[number]);
    }
}