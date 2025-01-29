export type LucideIcon =
    | 'alarm-check'
    | 'file-text'
    | 'message-circle'
    | 'inbox'
    | 'star'
    | 'heart'
    | 'user';

export interface Stream {
    id: string;
    name: string;
    folder: string;
    icon: LucideIcon;
    showInRibbon: boolean;
}

export interface StreamsSettings {
    streams: Stream[];
} 