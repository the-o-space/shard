import { TFile, App } from 'obsidian';
import { ViewStateManager } from '../model/ViewStateManager';

export function buildShardTree(
  tree: Record<string, any>,
  currentFile: TFile | null,
  onCategoryContextMenu: (evt: MouseEvent, path: string) => void,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App,
  viewStateManager?: ViewStateManager
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'tag-tree';
  renderTree(tree, root, 0, [], currentFile, onCategoryContextMenu, onFileContextMenu, app, viewStateManager);
  return root;
}

function renderTree(
  node: Record<string, any>,
  el: HTMLElement,
  depth: number,
  path: string[],
  currentFile: TFile | null,
  onCategoryContextMenu: (evt: MouseEvent, path: string) => void,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App,
  viewStateManager?: ViewStateManager
) {
  Object.keys(node).sort().forEach(key => {
    if (key === 'files') return;
    const currentPath = [...path, key];
    const currentPathString = currentPath.join('/');
    const treeItem = el.createDiv({ cls: 'tree-item nav-folder' });
    
    // Check if this path should be collapsed
    const isCollapsed = viewStateManager?.isPathCollapsed(currentPathString) ?? true;
    if (isCollapsed) {
      treeItem.addClass('is-collapsed');
    }
    
    const titleDiv = treeItem.createDiv({ cls: 'tree-item-self nav-folder-title is-clickable mod-collapsible' });
    titleDiv.setAttribute('data-path', currentPathString);
    titleDiv.setAttribute('draggable', 'true');
    const basePadding = 8;
    const perLevelIndent = 16;
    const paddingStart = basePadding + (depth * perLevelIndent);
    const marginStart = depth > 0 ? -(depth * perLevelIndent) : 0;
    titleDiv.style.marginInlineStart = `${marginStart}px !important`;
    titleDiv.style.paddingInlineStart = `${paddingStart}px !important`;
    const collapseIcon = document.createElement('div');
    // Start with the appropriate state
    collapseIcon.className = 'tree-item-icon collapse-icon' + (isCollapsed ? ' is-collapsed' : '');
    collapseIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>';
    titleDiv.appendChild(collapseIcon);
    const titleContent = titleDiv.createDiv({ cls: 'tree-item-inner nav-folder-title-content', text: key });
    const childrenContainer = treeItem.createDiv({ cls: 'tree-item-children nav-folder-children' });
    titleDiv.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      onCategoryContextMenu(evt, currentPathString);
    });
    titleDiv.addEventListener('mousedown', (evt) => {
      if (evt.button !== 0) return; // left-click only
      const isCurrentlyCollapsed = treeItem.hasClass('is-collapsed');
      treeItem.toggleClass('is-collapsed', !isCurrentlyCollapsed);
      collapseIcon.toggleClass('is-collapsed', !isCurrentlyCollapsed);
      
      // Persist the state
      if (viewStateManager) {
        viewStateManager.togglePath(currentPathString);
      }
    });
    renderTree(node[key], childrenContainer, depth + 1, currentPath, currentFile, onCategoryContextMenu, onFileContextMenu, app, viewStateManager);
    if (node[key].files) {
      node[key].files.forEach((file: TFile) => {
        const fileItem = childrenContainer.createDiv({ cls: 'tree-item nav-file' });
        const isActive = currentFile && file.path === currentFile.path;
        const fileTitle = fileItem.createDiv({
          cls: 'tree-item-self nav-file-title tappable is-clickable' +
            (isActive ? ' is-active has-focus shard-current-file' : ''),
        });
        fileTitle.setAttribute('data-path', file.path);
        fileTitle.setAttribute('draggable', 'true');
        const fileDepth = depth + 1;
        const filePaddingStart = basePadding + (fileDepth * perLevelIndent);
        const fileMarginStart = -(fileDepth * perLevelIndent);
        fileTitle.style.marginInlineStart = `${fileMarginStart}px !important`;
        fileTitle.style.paddingInlineStart = `${filePaddingStart}px !important`;
        fileTitle.createDiv({ cls: 'tree-item-inner nav-file-title-content', text: file.basename });
        fileTitle.addEventListener('contextmenu', (evt) => {
          evt.preventDefault();
          onFileContextMenu(evt, file);
        });
        fileTitle.addEventListener('mousedown', (evt) => {
          if (evt.button !== 0) return; 
          evt.preventDefault();
          evt.stopPropagation();
          app.workspace.openLinkText(file.path, '');
        });
      });
    }
  });
} 