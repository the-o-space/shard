export interface ShardViewState {
  collapsedSections: string[];
  collapsedPaths: string[];
  lastActiveFile?: string;
  hasBeenInitialized?: boolean;
}

export class ViewStateManager {
  private state: ShardViewState;
  private saveCallback: () => void;
  private isFirstRun: boolean;

  constructor(
    initialState?: Partial<ShardViewState>,
    onStateChange?: () => void
  ) {
    this.isFirstRun = !initialState?.hasBeenInitialized;
    this.state = {
      collapsedSections: initialState?.collapsedSections || [],
      collapsedPaths: initialState?.collapsedPaths || [],
      lastActiveFile: initialState?.lastActiveFile,
      hasBeenInitialized: true
    };
    this.saveCallback = onStateChange || (() => {});
  }

  /**
   * Get current state
   */
  getState(): ShardViewState {
    return { ...this.state };
  }

  /**
   * Update collapsed sections
   */
  setCollapsedSections(sections: string[]) {
    this.state.collapsedSections = [...sections];
    this.saveCallback();
  }

  /**
   * Update collapsed shard paths
   */
  setCollapsedPaths(paths: string[]) {
    this.state.collapsedPaths = [...paths];
    this.saveCallback();
  }

  /**
   * Toggle section collapse state
   */
  toggleSection(sectionName: string) {
    const index = this.state.collapsedSections.indexOf(sectionName);
    if (index === -1) {
      this.state.collapsedSections.push(sectionName);
    } else {
      this.state.collapsedSections.splice(index, 1);
    }
    this.saveCallback();
  }

  /**
   * Toggle path collapse state
   */
  togglePath(path: string) {
    const index = this.state.collapsedPaths.indexOf(path);
    if (index === -1) {
      this.state.collapsedPaths.push(path);
    } else {
      this.state.collapsedPaths.splice(index, 1);
    }
    this.saveCallback();
  }

  /**
   * Check if section is collapsed
   */
  isSectionCollapsed(sectionName: string): boolean {
    return this.state.collapsedSections.includes(sectionName);
  }

  /**
   * Check if path is collapsed
   */
  isPathCollapsed(path: string): boolean {
    return this.state.collapsedPaths.includes(path);
  }

  /**
   * Set last active file
   */
  setLastActiveFile(filePath: string | undefined) {
    this.state.lastActiveFile = filePath;
    this.saveCallback();
  }

  /**
   * Get last active file
   */
  getLastActiveFile(): string | undefined {
    return this.state.lastActiveFile;
  }

  /**
   * Clear all state
   */
  clear() {
    this.state = {
      collapsedSections: [],
      collapsedPaths: [],
      lastActiveFile: undefined,
      hasBeenInitialized: true
    };
    this.saveCallback();
  }

  /**
   * Check if this is the first run
   */
  checkIsFirstRun(): boolean {
    return this.isFirstRun;
  }
} 