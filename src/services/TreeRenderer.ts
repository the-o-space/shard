import { TFile, App } from 'obsidian';
import { ViewStateManager } from '../model/ViewStateManager';
import { buildShardTree } from '../ui/Tree';

export class TreeRenderer {
  private app: App;
  private viewStateManager: ViewStateManager;
  private onCategoryContextMenu: (evt: MouseEvent, path: string) => void;
  private onFileContextMenu: (evt: MouseEvent, file: TFile) => void;

  constructor(
    app: App,
    viewStateManager: ViewStateManager,
    onCategoryContextMenu: (evt: MouseEvent, path: string) => void,
    onFileContextMenu: (evt: MouseEvent, file: TFile) => void
  ) {
    this.app = app;
    this.viewStateManager = viewStateManager;
    this.onCategoryContextMenu = onCategoryContextMenu;
    this.onFileContextMenu = onFileContextMenu;
  }

  renderTreeSection(tree: Record<string, any>, currentFile: TFile | null): HTMLElement {
    return buildShardTree(
      tree,
      currentFile,
      this.onCategoryContextMenu,
      this.onFileContextMenu,
      this.app,
      this.viewStateManager
    );
  }

  renderFileList(files: TFile[], currentFile: TFile | null, emptyMessage: string = 'No files'): HTMLElement {
    const container = document.createElement('div');
    
    if (files.length === 0) {
      container.createEl('div', { cls: 'pane-empty', text: emptyMessage });
      return container;
    }

    files.forEach((file) => {
      const fileItem = container.createDiv({ cls: 'tree-item nav-file' });
      const isActive = currentFile && file.path === currentFile.path;
      const fileTitle = fileItem.createDiv({
        cls: 'tree-item-self nav-file-title is-clickable' +
          (isActive ? ' is-active has-focus shard-current-file' : ''),
      });
      fileTitle.setAttribute('data-path', file.path);
      fileTitle.setAttribute('draggable', 'true');
      fileTitle.createDiv({ cls: 'tree-item-inner nav-file-title-content', text: file.basename });
      
      fileTitle.addEventListener('contextmenu', (evt) => {
        evt.preventDefault();
        this.onFileContextMenu(evt, file);
      });
      
      fileTitle.addEventListener('mousedown', (evt) => {
        if (evt.button !== 0) return;
        evt.preventDefault();
        evt.stopPropagation();
        this.app.workspace.openLinkText(file.path, '');
      });
    });
    
    return container;
  }

  highlightActiveFileInTree(container: HTMLElement, currentFile: TFile | null): void {
    if (!container) return;

    const prevActiveFile = this.viewStateManager.getLastActiveFile();
    
    if (prevActiveFile) {
      const escapedPrev = (window.CSS && CSS.escape) ? CSS.escape(prevActiveFile) : prevActiveFile.replace(/"/g, '\\"');
      const prevElements = container.querySelectorAll<HTMLElement>(`.nav-file-title[data-path="${escapedPrev}"]`);
      prevElements.forEach(el => {
        el.removeClass('is-active');
        el.removeClass('has-focus');
        el.removeClass('shard-current-file');
      });
    }

    this.viewStateManager.setLastActiveFile(currentFile?.path);

    if (!currentFile) {
      return;
    }

    const escapedNew = (window.CSS && CSS.escape) ? CSS.escape(currentFile.path) : currentFile.path.replace(/"/g, '\\"');
    const newElements = container.querySelectorAll<HTMLElement>(`.nav-file-title[data-path="${escapedNew}"]`);
    newElements.forEach(el => {
      el.addClass('is-active');
      el.addClass('has-focus');
      el.addClass('shard-current-file');
    });
  }
} 