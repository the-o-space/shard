import { ViewStateManager } from '../model/ViewStateManager';

export class SectionRenderer {
  private viewStateManager: ViewStateManager;
  private container: HTMLElement | null;

  constructor(viewStateManager: ViewStateManager) {
    this.viewStateManager = viewStateManager;
    this.container = null;
  }

  /**
   * Set the container element for rendering sections
   */
  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * Render a collapsible section with header and content
   */
  async renderSection(name: string, contentBuilder: () => Promise<HTMLElement>): Promise<void> {
    if (!this.container) return;

    const wrapper = this.container.createDiv({ cls: 'shard-section' });
    const header = wrapper.createEl('h5', { text: name, cls: 'shard-subheader' });
    const contentDiv = wrapper.createDiv({ cls: 'shard-section-content' });

    // Determine initial collapse status
    let shouldCollapse: boolean;
    if (this.viewStateManager.checkIsFirstRun()) {
      shouldCollapse = name !== 'All Shards';
      if (shouldCollapse && !this.viewStateManager.isSectionCollapsed(name)) {
        this.viewStateManager.toggleSection(name);
      }
    } else {
      shouldCollapse = this.viewStateManager.isSectionCollapsed(name);
    }

    if (shouldCollapse) {
      contentDiv.style.display = 'none';
    }

    // Handle section header clicks
    header.addEventListener('mousedown', (evt) => {
      if (evt.button !== 0) return; // left click only
      const isCollapsed = contentDiv.style.display === 'none';
      contentDiv.style.display = isCollapsed ? '' : 'none';
      this.viewStateManager.toggleSection(name);
    });

    // Prevent default context menu to avoid accidental edit
    header.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
    });

    // Build and append content
    const contentEl = await contentBuilder();
    contentDiv.appendChild(contentEl);
  }

  /**
   * Preserve collapsed state before re-rendering
   */
  preserveCollapsedState(container: HTMLElement): void {
    if (!container) return;

    // Preserve collapsed paths
    const collapsedPaths: string[] = [];
    container.querySelectorAll('.tree-item.nav-folder.is-collapsed').forEach(el => {
      const titleDiv = el.querySelector<HTMLElement>('.tree-item-self.nav-folder-title');
      const path = titleDiv?.getAttribute('data-path');
      if (path) collapsedPaths.push(path);
    });
    
    if (collapsedPaths.length > 0) {
      this.viewStateManager.setCollapsedPaths(collapsedPaths);
    }

    // Preserve collapsed sections
    const collapsedSections: string[] = [];
    container.querySelectorAll('.shard-section').forEach(sectionDiv => {
      const header = sectionDiv.querySelector<HTMLHeadingElement>('h5');
      const name = header?.textContent?.trim();
      if (!name) return;
      const content = sectionDiv.querySelector<HTMLElement>('.shard-section-content');
      if (content && content.style.display === 'none') {
        collapsedSections.push(name);
      }
    });
    this.viewStateManager.setCollapsedSections(collapsedSections);
  }

  /**
   * Clear the container
   */
  clearContainer(): void {
    if (this.container) {
      this.container.empty();
    }
  }
} 