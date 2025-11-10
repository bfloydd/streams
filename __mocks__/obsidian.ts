// Mock implementation of Obsidian API for Jest tests
// This provides minimal implementations of the classes and types used in tests

export interface MockPlugins {
  plugins: Record<string, unknown>;
}

export interface MockCommands {
  commands: Record<string, unknown>;
}

export interface MockVault {
  [key: string]: unknown;
}

export interface MockWorkspace {
  [key: string]: unknown;
}

export class App {
  plugins: MockPlugins;
  commands: MockCommands;
  vault: MockVault;
  workspace: MockWorkspace;
  
  constructor() {
    this.plugins = {
      plugins: {},
    };
    this.commands = {
      commands: {},
    };
    this.vault = {};
    this.workspace = {};
  }
}

export interface MockSettings {
  [key: string]: unknown;
}

export class Plugin {
  app: App;
  settings: MockSettings;
  
  constructor(app: App) {
    this.app = app;
    this.settings = {};
  }
}

export class TFile {
  path: string;
  name: string;
  extension: string;
  
  constructor(path: string, name: string, extension: string) {
    this.path = path;
    this.name = name;
    this.extension = extension;
  }
}

export class TFolder {
  path: string;
  name: string;
  
  constructor(path: string, name: string) {
    this.path = path;
    this.name = name;
  }
}

export interface MockView {
  getViewType: () => string;
  [key: string]: unknown;
}

export interface MockViewState {
  [key: string]: unknown;
}

export class WorkspaceLeaf {
  view: MockView;
  viewState: MockViewState;
  
  constructor() {
    this.view = {
      getViewType: () => 'markdown',
    };
    this.viewState = {};
  }
  
  async setViewState(state: MockViewState): Promise<void> {
    this.viewState = state;
  }
  
  async openFile(file: TFile): Promise<void> {
    // Mock implementation
  }
}

export class ItemView {
  navigation: boolean = false;
  contentEl: HTMLElement;
  leaf: WorkspaceLeaf;
  app: App;
  
  constructor(leaf: WorkspaceLeaf, app: App) {
    this.leaf = leaf;
    this.app = app;
    // Use a simple mock element if document is not available
    this.contentEl = (typeof document !== 'undefined' 
      ? document.createElement('div')
      : { innerHTML: '', appendChild: () => {}, remove: () => {} } as any);
  }
  
  getViewType(): string {
    return 'item-view';
  }
  
  getDisplayText(): string {
    return '';
  }
  
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export class MarkdownView extends ItemView {
  constructor(leaf: WorkspaceLeaf, app: App) {
    super(leaf, app);
  }
  
  getViewType(): string {
    return 'markdown';
  }
}

export function setIcon(el: HTMLElement, icon: string): void {
  // Mock implementation
}

export class Notice {
  message: string;
  timeout: number;
  
  constructor(message: string, timeout: number = 0) {
    this.message = message;
    this.timeout = timeout;
  }
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

// Export other commonly used types/interfaces
export interface Component {}
export interface ViewState {}
export interface WorkspaceItem {}

