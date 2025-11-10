/**
 * Utility functions for date parsing and manipulation
 */
export class DateUtils {
    /**
     * Extract date from a file path (e.g., "2025-10-08.md" -> Date)
     * @param filePath The file path to extract date from
     * @returns The extracted date or current date if not found
     */
    static extractDateFromFilePath(filePath: string): Date {
        const fileName = filePath.split('/').pop() || '';
        const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);

        if (!dateMatch) {
            return new Date(); // Default to current date
        }

        const dateString = dateMatch[1];
        // Parse date as local date to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day); // month is 0-indexed

        if (isNaN(targetDate.getTime())) {
            return new Date(); // Fallback to current date
        }

        return targetDate;
    }

    /**
     * Check if a date string is valid
     * @param dateString The date string to validate
     * @returns True if valid, false otherwise
     */
    static isValidDateString(dateString: string): boolean {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }

    /**
     * Format a date as YYYY-MM-DD
     * @param date The date to format
     * @returns Formatted date string
     */
    static formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}