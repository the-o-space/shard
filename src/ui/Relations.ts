import { TFile, App, setIcon } from 'obsidian';
import { Relation, RelationType } from '../domain/Relation';

export function buildRelationsPanel(
  relations: {
    asSource: Relation[];
    asTarget: Relation[];
  },
  currentFile: TFile | null,
  onFileClick: (file: TFile) => void,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'relations-content';
  
  // Add file header like in the original
  if (currentFile) {
    const headerEl = container.createDiv({ cls: 'relations-header' });
    headerEl.createEl('h5', { text: currentFile.basename });
  }

  // Convert relations to the display format used by the original UI
  type DisplayEntry = {
    file: TFile;
    label?: string;
    relationType: 'parent' | 'child' | 'related';
  };

  const parents: DisplayEntry[] = [];
  const children: DisplayEntry[] = [];
  const related: DisplayEntry[] = [];

  // Process relations where current file is source
  for (const relation of relations.asSource) {
    const entry: DisplayEntry = {
      file: relation.identity.targetFile,
      label: relation.sourceLabel?.value,
      relationType: mapRelationType(relation.identity.type)
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

  // Process relations where current file is target to find inverse relations
  for (const relation of relations.asTarget) {
    const inverseType = getInverseType(relation.identity.type);
    const entry: DisplayEntry = {
      file: relation.identity.sourceFile,
      label: relation.targetLabel?.value,
      relationType: inverseType
    };
    
    // Only add if not already present (avoid duplicates from bidirectional sync)
    const isDuplicate = (list: DisplayEntry[]) => 
      list.some(e => e.file.path === entry.file.path && e.label === entry.label);
    
    switch (entry.relationType) {
      case 'parent':
        if (!isDuplicate(parents)) parents.push(entry);
        break;
      case 'child':
        if (!isDuplicate(children)) children.push(entry);
        break;
      case 'related':
        if (!isDuplicate(related)) related.push(entry);
        break;
    }
  }

  // Separate labeled and unlabeled entries
  const unlabeledParents = parents.filter(e => !e.label);
  const unlabeledChildren = children.filter(e => !e.label);
  const unlabeledRelated = related.filter(e => !e.label);

  // Render unlabeled sections
  if (unlabeledParents.length > 0) {
    renderSection(container, 'Parents', unlabeledParents, 'relation-parents', currentFile, onFileClick, onFileContextMenu, app, 'parent');
  }
  if (unlabeledRelated.length > 0) {
    renderSection(container, 'Related', unlabeledRelated, 'relation-related', currentFile, onFileClick, onFileContextMenu, app, 'related');
  }
  if (unlabeledChildren.length > 0) {
    renderSection(container, 'Children', unlabeledChildren, 'relation-children', currentFile, onFileClick, onFileContextMenu, app, 'child');
  }

  // Group labeled entries
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

  // Render labeled groups
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

  // Show empty state if no relations
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
      // Use Obsidian's API to open the file
      app.workspace.openLinkText(file.path, '');
    });
    
    fileTitle.addEventListener('contextmenu', (evt) => {
      onFileContextMenu(evt, file);
    });
  });
}

function mapRelationType(type: RelationType): 'parent' | 'child' | 'related' {
  switch (type) {
    case RelationType.Parent:
      return 'parent';
    case RelationType.Child:
      return 'child';
    case RelationType.Related:
      return 'related';
  }
}

function getInverseType(type: RelationType): 'parent' | 'child' | 'related' {
  switch (type) {
    case RelationType.Parent:
      return 'child';
    case RelationType.Child:
      return 'parent';
    case RelationType.Related:
      return 'related';
  }
} 