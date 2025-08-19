export type LucideIcon =
    // Files & Documents
    | 'file-text' | 'file' | 'files' | 'folder' | 'book' | 'notebook' | 'diary'
    // Communication & Social
    | 'message-circle' | 'message-square' | 'mail' | 'inbox' | 'send'
    // Time & Planning
    | 'alarm-check' | 'calendar' | 'clock' | 'timer' | 'history'
    // UI Elements
    | 'home' | 'settings' | 'search' | 'bookmark' | 'star' | 'heart' | 'layout-dashboard'
    // Content
    | 'text' | 'edit' | 'pencil' | 'pen' | 'list' | 'check-square'
    // Media
    | 'image' | 'video' | 'music' | 'camera'
    // Weather & Nature
    | 'sun' | 'moon' | 'cloud' | 'umbrella'
    // Misc
    | 'user' | 'users' | 'tag' | 'flag' | 'bookmark' | 'link';

export interface Stream {
    id: string;
    name: string;
    folder: string;
    icon: LucideIcon;
    viewIcon: LucideIcon;
    showTodayInRibbon: boolean;
    
    showFullStreamInRibbon: boolean;
    addCommand: boolean;
    addViewCommand: boolean;
    // Ribbon icon styling options
    showTodayBorder: boolean;
    showViewBorder: boolean;
    todayBorderColor: string;
    viewBorderColor: string;
}

export interface StreamsSettings {
    streams: Stream[];
    showCalendarComponent: boolean;
    reuseCurrentTab: boolean;
    calendarCompactState: boolean;
    activeStreamId?: string; // ID of the currently active/selected stream
} 