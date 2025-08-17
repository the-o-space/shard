import { TFile, App } from 'obsidian';
import { RelationEntry } from '../types';

export function buildRelationsPanel(
  file: TFile,
  relations: { parents: RelationEntry[]; related: RelationEntry[]; children: RelationEntry[] },
  currentFile: TFile | null,
  onFileContextMenu: (evt: MouseEvent, file: TFile) => void,
  app: App
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'relations-content';
  const headerEl = container.createDiv({ cls: 'relations-header' });
  headerEl.createEl('h5', { text: file.basename });

  type DisplayEntry = RelationEntry & { relationType: 'parent' | 'child' | 'related' };

  const parentEntries: DisplayEntry[] = relations.parents.map(e => ({ ...e, relationType: 'parent' }));
  const childEntries: DisplayEntry[] = relations.children.map(e => ({ ...e, relationType: 'child' }));
  const relatedEntries: DisplayEntry[] = relations.related.map(e => ({ ...e, relationType: 'related' }));

  const unlabeledParents = parentEntries.filter(e => !e.label);
  const unlabeledChildren = childEntries.filter(e => !e.label);
  const unlabeledRelated = relatedEntries.filter(e => !e.label);

  if (unlabeledParents.length > 0) {
    renderSection(container, 'Parents', unlabeledParents, 'relation-parents', currentFile, onFileContextMenu, app, 'parent');
  }
  if (unlabeledRelated.length > 0) {
    renderSection(container, 'Related', unlabeledRelated, 'relation-related', currentFile, onFileContextMenu, app, 'related');
  }
  if (unlabeledChildren.length > 0) {
    renderSection(container, 'Children', unlabeledChildren, 'relation-children', currentFile, onFileContextMenu, app, 'child');
  }

  type LabelKey = string;
  const labeledGroups: Map<LabelKey, DisplayEntry[]> = new Map();
  const addToGroup = (entry: DisplayEntry) => {
    if (!entry.label) return;
    const key = `${entry.label}|${entry.relationType}`;
    if (!labeledGroups.has(key)) labeledGroups.set(key, []);
    labeledGroups.get(key)!.push(entry);
  };
  parentEntries.forEach(addToGroup);
  childEntries.forEach(addToGroup);
  relatedEntries.forEach(addToGroup);

  labeledGroups.forEach((entries, key) => {
    const [label, relationType] = key.split('|') as [string, 'parent' | 'child' | 'related'];
    renderSection(
      container,
      label,
      entries,
      'relation-labeled',
      currentFile,
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
  entries: Array<RelationEntry & { relationType: 'parent' | 'child' | 'related' }>,
  className: string,
  currentFile: TFile | null,
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

  entries.forEach(({ file, relationType }) => {
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