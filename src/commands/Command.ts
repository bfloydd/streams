export interface Command {
    execute(): Promise<void>;
} 