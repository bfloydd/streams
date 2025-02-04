export type LucideIcon =
    // Files & Documents
    | 'file-text' | 'file' | 'files' | 'folder' | 'book' | 'notebook' | 'diary'
    // Communication & Social
    | 'message-circle' | 'message-square' | 'mail' | 'inbox' | 'send'
    // Time & Planning
    | 'alarm-check' | 'calendar' | 'clock' | 'timer' | 'history'
    // UI Elements
    | 'home' | 'settings' | 'search' | 'bookmark' | 'star' | 'heart'
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
    showInRibbon: boolean;
    addCommand: boolean;
}

export interface StreamsSettings {
    streams: Stream[];
} 