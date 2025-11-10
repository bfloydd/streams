import { CalendarViewChecker } from '../../shared/interfaces';
import { configurationService } from '../../shared/ConfigurationService';

/**
 * Service for determining which view types should have calendar components
 * Follows Single Responsibility Principle - only handles calendar view logic
 */
export class CalendarViewService implements CalendarViewChecker {
    /**
     * Check if a view type should have a calendar component
     */
    shouldCreateCalendarForViewType(viewType: string): boolean {
        const enabledTypes = configurationService.getViewConfig().CALENDAR_ENABLED_VIEW_TYPES;
        return enabledTypes.includes(viewType as typeof enabledTypes[number]);
    }
}
