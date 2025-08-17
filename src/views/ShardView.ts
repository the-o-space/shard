import { ItemView, WorkspaceLeaf, TFile, Menu } from 'obsidian';
import { ShardParser } from '../model/ShardParser';
import { RelationsManager } from '../model/RelationsManager';
import { buildShardTree } from '../ui/Tree';
import { buildRelationsPanel } from '../ui/Relations';

export const VIEW_TYPE_SHARD_FILE = 'shard-file-view';

export class ShardView extends ItemView {
  private parser: ShardParser;
  private relationsManager: RelationsManager;
  private treeContainer: HTMLElement | null = null;
  private relationsContainer: HTMLElement | null = null;
  private currentFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, relationsManager: RelationsManager) {
    super(leaf);
    this.parser = new ShardParser();
    this.relationsManager = relationsManager;
  }

  getViewType() {
    return VIEW_TYPE_SHARD_FILE;
  }

  getDisplayText() {
    return 'Shards';
  }

  getIcon(): string {
    return 'tags';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('shard-view-container');

    // Top section: Shard Tree
    this.treeContainer = container.createDiv({ cls: 'shard-tree-section' });
    this.treeContainer.createEl('h4', { text: 'Shard Tree', cls: 'shard-section-header' });

    // Bottom section: Relations
    this.relationsContainer = container.createDiv({ cls: 'shard-relations-section' });
    this.relationsContainer.createEl('h4', { text: 'Relations', cls: 'shard-section-header' });

    await this.renderAll();

    // Listen for active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        await this.renderAll();
      })
    );

    // Listen for file saves (near-live update)
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          await this.relationsManager.updateFileRelations(file);
          await this.renderAll();
        }
      })
    );

    // Listen for file creations
    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (file instanceof TFile) {
          await this.renderAll();
        }
      })
    );

    // Listen for file deletions/renames
    this.registerEvent(
      this.app.vault.on('delete', async () => await this.renderAll())
    );
    this.registerEvent(
      this.app.vault.on('rename', async () => await this.renderAll())
    );
  }

  async renderAll() {
    this.currentFile = this.app.workspace.getActiveFile();
    await this.renderShardTree();
    await this.renderRelations();
  }

  async renderShardTree() {
    if (!this.treeContainer) return;

    // --- Preserve current collapsed state before rerendering ---
    const collapsedPaths = new Set<string>();
    // Collect all folder items that are currently collapsed and remember their data-path
    this.treeContainer.querySelectorAll('.tree-item.nav-folder.is-collapsed').forEach(el => {
      const titleDiv = el.querySelector<HTMLElement>('.tree-item-self.nav-folder-title');
      const path = titleDiv?.getAttribute('data-path');
      if (path) collapsedPaths.add(path);
    });

    // Clear the existing tree contents
    this.treeContainer.empty();

    const files = this.app.vault.getMarkdownFiles();
    const shardTree: Record<string, any> = {};
    const filesInTree = new Set<string>();
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const shards = this.parser.parseShardsFromContent(content);
      if (shards.length === 0) continue;
      shards.forEach((shard: string) => {
        const parsed = this.parser.parseShard(shard);
        if (parsed.type === 'regular') {
          const expandedShards = this.parser.expandMultiShard(parsed.value);
          expandedShards.forEach((expShard: string) => {
            const parts = expShard.split('/').filter((p: string) => p.length > 0);
            if (parts.length === 0) return;
            if (parts.length === 1) {
              if (!shardTree[parts[0]]) shardTree[parts[0]] = {};
              const node = shardTree[parts[0]];
              if (!node.files) node.files = [];
              node.files.push(file);
              filesInTree.add(file.path);
            } else {
              let current = shardTree;
              parts.forEach((part: string, index: number) => {
                if (!current[part]) current[part] = {};
                current = current[part];
                if (index === parts.length - 1) {
                  if (!current.files) current.files = [];
                  current.files.push(file);
                  filesInTree.add(file.path);
                }
              });
            }
          });
        }
      });
    }
    const tree = buildShardTree(
      shardTree,
      this.currentFile,
      (evt, path) => this.showCategoryContextMenu(evt, path),
      (evt, file) => this.showFileContextMenu(evt, file),
      this.app
    );
    this.treeContainer.appendChild(tree);

    // --- Restore previously collapsed state ---
    if (collapsedPaths.size > 0) {
      this.treeContainer.querySelectorAll<HTMLElement>('.tree-item.nav-folder').forEach(folderEl => {
        const titleDiv = folderEl.querySelector<HTMLElement>('.tree-item-self.nav-folder-title');
        const path = titleDiv?.getAttribute('data-path');
        if (path && collapsedPaths.has(path)) {
          folderEl.addClass('is-collapsed');
          titleDiv?.querySelector('.collapse-icon')?.addClass('is-collapsed');
        }
      });
    }
    const uncategorized = files.filter(f => !filesInTree.has(f.path));
    if (uncategorized.length > 0) {
      const uncategorizedSection = tree.createDiv({ cls: 'uncategorized-section' });
      uncategorizedSection.createEl('div', { text: 'Uncategorized', cls: 'uncategorized-header' });
      uncategorized.forEach(file => {
        const fileItem = uncategorizedSection.createDiv({ cls: 'tree-item nav-file' });
        const fileTitle = fileItem.createDiv({
          cls: 'tree-item-self nav-file-title tappable is-clickable' +
            (this.currentFile && file.basename === this.currentFile.basename ? ' is-active has-focus shard-current-file' : ''),
        });
        fileTitle.setAttribute('data-path', file.path);
        fileTitle.setAttribute('draggable', 'true');
        fileTitle.createDiv({ cls: 'tree-item-inner nav-file-title-content', text: file.basename });
        fileTitle.addEventListener('contextmenu', (evt) => {
          evt.preventDefault();
          this.showFileContextMenu(evt, file);
        });
        fileTitle.addEventListener('mousedown', (evt) => {
          if (evt.button !== 0) return;
          evt.preventDefault();
          evt.stopPropagation();
          this.app.workspace.openLinkText(file.path, '');
        });
      });
    }
  }

  async renderRelations() {
    if (!this.relationsContainer) return;
    this.relationsContainer.empty();
    if (!this.currentFile || this.currentFile.extension !== 'md') {
      this.relationsContainer.createEl('div', { cls: 'pane-empty', text: 'No markdown file open' });
      return;
    }
    const relations = await this.relationsManager.getFileRelations(this.currentFile);
    const panel = buildRelationsPanel(
      this.currentFile,
      relations,
      this.currentFile,
      (evt, file) => this.showFileContextMenu(evt, file),
      this.app
    );
    this.relationsContainer.appendChild(panel);
  }

  showCategoryContextMenu(evt: MouseEvent, shardPath: string) {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle('New note')
        .setIcon('document')
        .onClick(async () => {
          await this.createNoteInCategory(shardPath);
        });
    });
    menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
  }

  showFileContextMenu(evt: MouseEvent, file: TFile) {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle('Delete')
        .setIcon('trash')
        .onClick(async () => {
          // Access the plugin's safeDelete method through the app
          const plugin = (this.app as any).plugins.plugins['shard'];
          if (plugin && plugin.safeDelete) {
            await plugin.safeDelete(file);
          }
        });
    });
    menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
  }

  async createNoteInCategory(shardPath: string) {
    let base = 'Untitled';
    let idx = 1;
    let name = base;
    const files = this.app.vault.getMarkdownFiles();
    while (files.some(f => f.basename === name)) {
      idx += 1;
      name = `${base} ${idx}`;
    }
    const filePath = `${name}.md`;
    const content = [
      '',
      '```shards',
      shardPath,
      '```',
      ''
    ].join('\n');
    const file = await this.app.vault.create(filePath, content);
    await this.app.workspace.openLinkText(file.path, '');
  }

  async onClose() {
  }
} 