 import { TFile, App } from 'obsidian';

export function buildShardTree(
  tree: Record<string, any>,
  currentFile: TFile | null,
  onCategoryContextMenu: (evt: MouseEvent, path: string) => void,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'tag-tree';
  renderTree(tree, root, 0, [], currentFile, onCategoryContextMenu, onFileContextMenu, app);
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
  app: App
) {
  Object.keys(node).sort().forEach(key => {
    if (key === 'files') return;
    const currentPath = [...path, key];
    const treeItem = el.createDiv({ cls: 'tree-item nav-folder' });
    const titleDiv = treeItem.createDiv({ cls: 'tree-item-self nav-folder-title is-clickable mod-collapsible' });
    titleDiv.setAttribute('data-path', currentPath.join('/'));
    titleDiv.setAttribute('draggable', 'true');
    const basePadding = 8;
    const perLevelIndent = 16;
    const paddingStart = basePadding + (depth * perLevelIndent);
    const marginStart = depth > 0 ? -(depth * perLevelIndent) : 0;
    titleDiv.style.marginInlineStart = `${marginStart}px !important`;
    titleDiv.style.paddingInlineStart = `${paddingStart}px !important`;
    const collapseIcon = document.createElement('div');
    collapseIcon.className = 'tree-item-icon collapse-icon';
    collapseIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>';
    titleDiv.appendChild(collapseIcon);
    const titleContent = titleDiv.createDiv({ cls: 'tree-item-inner nav-folder-title-content', text: key });
    const childrenContainer = treeItem.createDiv({ cls: 'tree-item-children nav-folder-children' });
    titleDiv.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      onCategoryContextMenu(evt, currentPath.join('/'));
    });
    titleDiv.addEventListener('mousedown', (evt) => {
      if (evt.button !== 0) return; // left-click only
      const isCollapsed = treeItem.hasClass('is-collapsed');
      treeItem.toggleClass('is-collapsed', !isCollapsed);
      collapseIcon.toggleClass('is-collapsed', !isCollapsed);
    });
    renderTree(node[key], childrenContainer, depth + 1, currentPath, currentFile, onCategoryContextMenu, onFileContextMenu, app);
    if (node[key].files) {
      node[key].files.forEach((file: TFile) => {
        const fileItem = childrenContainer.createDiv({ cls: 'tree-item nav-file' });
        const fileTitle = fileItem.createDiv({
          cls: 'tree-item-self nav-file-title tappable is-clickable' +
            (currentFile && file.basename === currentFile.basename ? ' is-active has-focus shard-current-file' : ''),
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