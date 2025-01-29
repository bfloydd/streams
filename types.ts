export interface Stream {
    id: string;
    name: string;
    folder: string;
    icon: string;
    showInRibbon: boolean;
}

export interface StreamsSettings {
    streams: Stream[];
} 