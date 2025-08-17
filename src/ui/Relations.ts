import { TFile, App } from 'obsidian';
import { Relation } from '../data/types/Relation';

export function buildRelationsPanel(
  relations: {
    outgoing: Relation[];
    incoming: Relation[];
  },
  currentFile: TFile | null,
  onFileClick: (file: TFile) => void,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App,
  vault = app.vault
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'relations-content';
  
  if (currentFile) {
    const headerEl = container.createDiv({ cls: 'relations-header' });
    headerEl.createEl('h5', { text: currentFile.basename });
  }

  type DisplayEntry = {
    file: TFile;
    label?: string;
    relationType: 'parent' | 'child' | 'related';
  };

  const parents: DisplayEntry[] = [];
  const children: DisplayEntry[] = [];
  const related: DisplayEntry[] = [];

  for (const relation of relations.outgoing) {
    const targetFile = vault.getFileByPath(relation.target.path);
    if (!(targetFile instanceof TFile)) continue;
    
    const entry: DisplayEntry = {
      file: targetFile,
      label: relation.label || undefined,
      relationType: mapTypeToRelationType(relation.type)
    };
    
    switch (entry.relationType) {
      case 'parent':
        parents.push(entry);
        break;
      case 'child':
        children.push(entry);
        break;
      case 'related':
        related.push(entry);
        break;
    }
  }

  const unlabeledParents = parents.filter(e => !e.label);
  const unlabeledChildren = children.filter(e => !e.label);
  const unlabeledRelated = related.filter(e => !e.label);

  if (unlabeledParents.length > 0) {
    renderSection(container, 'Parents', unlabeledParents, 'relation-parents', currentFile, onFileClick, onFileContextMenu, app, 'parent');
  }
  if (unlabeledRelated.length > 0) {
    renderSection(container, 'Related', unlabeledRelated, 'relation-related', currentFile, onFileClick, onFileContextMenu, app, 'related');
  }
  if (unlabeledChildren.length > 0) {
    renderSection(container, 'Children', unlabeledChildren, 'relation-children', currentFile, onFileClick, onFileContextMenu, app, 'child');
  }

  type LabelKey = string;
  const labeledGroups: Map<LabelKey, DisplayEntry[]> = new Map();
  
  const addToGroup = (entry: DisplayEntry) => {
    if (!entry.label) return;
    const key = `${entry.label}|${entry.relationType}`;
    if (!labeledGroups.has(key)) labeledGroups.set(key, []);
    labeledGroups.get(key)!.push(entry);
  };
  
  parents.forEach(addToGroup);
  children.forEach(addToGroup);
  related.forEach(addToGroup);

  labeledGroups.forEach((entries, key) => {
    const [label, relationType] = key.split('|') as [string, 'parent' | 'child' | 'related'];
    renderSection(
      container,
      label,
      entries,
      'relation-labeled',
      currentFile,
      onFileClick,
      onFileContextMenu,
      app,
      relationType
    );
  });

  if (
    unlabeledParents.length === 0 &&
    unlabeledChildren.length === 0 &&
    unlabeledRelated.length === 0 &&
    labeledGroups.size === 0
  ) {
    container.createEl('div', { cls: 'pane-empty', text: 'No relations defined' });
  }

  return container;
}

function renderSection(
  container: HTMLElement,
  title: string,
  entries: Array<{ file: TFile; label?: string; relationType: 'parent' | 'child' | 'related' }>,
  className: string,
  currentFile: TFile | null,
  onFileClick: (file: TFile) => void,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App,
  sectionRelationType?: 'parent' | 'child' | 'related'
) {
  const sectionEl = container.createDiv({ cls: `relations-section ${className}` });
  
  let headerText = title;
  if (sectionRelationType) {
    const arrow = sectionRelationType === 'parent' ? '↑' : sectionRelationType === 'child' ? '↓' : '↔';
    headerText = `${arrow} ${title}`;
  }
  sectionEl.createEl('h6', { text: headerText });
  
  const listEl = sectionEl.createEl('div', { cls: 'relations-list' });

  entries.forEach(({ file }) => {
    const itemEl = listEl.createDiv({ cls: 'tree-item nav-file' });
    const fileTitle = itemEl.createDiv({
      cls:
        'tree-item-self nav-file-title is-clickable' +
        (currentFile && file.basename === currentFile.basename ? ' is-active has-focus shard-current-file' : ''),
    });
    fileTitle.createSpan({ cls: 'relation-text', text: file.basename });

    fileTitle.setAttribute('data-path', file.path);
    fileTitle.setAttribute('draggable', 'true');
    
    fileTitle.addEventListener('mousedown', (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      app.workspace.openLinkText(file.path, '');
    });
    
    fileTitle.addEventListener('contextmenu', (evt) => {
      onFileContextMenu(evt, file);
    });
  });
}

function mapTypeToRelationType(type: string): 'parent' | 'child' | 'related' {
  switch (type) {
    case '>':
      return 'parent';
    case '<':
      return 'child';
    case '~':
      return 'related';
    default:
      return 'related';
  }
} 