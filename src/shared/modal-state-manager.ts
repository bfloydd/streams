/**
 * Temporary state manager for modal settings that persist during the current session
 * This is not saved to data.json or any persistent storage
 */
export interface ModalState {
    selectedStreamId: string | null;
    useSourceDate: boolean;
    selectedDate: string;
    prependMode: boolean;
    addDivider: boolean;
}

export class ModalStateManager {
    private static instance: ModalStateManager;
    private state: ModalState = {
        selectedStreamId: null,
        useSourceDate: true,
        selectedDate: new Date().toISOString().split('T')[0],
        prependMode: false,
        addDivider: true
    };

    private constructor() {}

    public static getInstance(): ModalStateManager {
        if (!ModalStateManager.instance) {
            ModalStateManager.instance = new ModalStateManager();
        }
        return ModalStateManager.instance;
    }

    /**
     * Get the current modal state
     */
    public getState(): ModalState {
        return { ...this.state };
    }

    /**
     * Update the modal state
     */
    public updateState(updates: Partial<ModalState>): void {
        this.state = { ...this.state, ...updates };
    }

    /**
     * Reset the modal state to defaults
     */
    public resetState(): void {
        this.state = {
            selectedStreamId: null,
            useSourceDate: true,
            selectedDate: new Date().toISOString().split('T')[0],
            prependMode: false,
            addDivider: true
        };
    }

    /**
     * Get a specific setting value
     */
    public getSetting<K extends keyof ModalState>(key: K): ModalState[K] {
        return this.state[key];
    }

    /**
     * Set a specific setting value
     */
    public setSetting<K extends keyof ModalState>(key: K, value: ModalState[K]): void {
        this.state[key] = value;
    }
}
