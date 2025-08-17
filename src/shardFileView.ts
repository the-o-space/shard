import { ItemView, WorkspaceLeaf, TFile, Editor, MarkdownView } from 'obsidian';
import { FileRelations, ShardNode } from './types';
import { ShardParser } from './parser';
import { RelationsManager } from './relationsManager';

export const VIEW_TYPE_SHARD_FILE = 'shard-file-view';

export class ShardFileView extends ItemView {
  private parser: ShardParser;
  private relationsManager: RelationsManager;
  private treeContainer: HTMLElement | null = null;
  private relationsContainer: HTMLElement | null = null;
  private currentFile: TFile | null = null;
  private debounceTimer: number | null = null;

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
    this.treeContainer = container.createEl('div', { cls: 'shard-tree-section' });
    const treeHeader = this.treeContainer.createEl('h4', { text: 'Shard Tree', cls: 'shard-section-header' });

    // Bottom section: Relations
    this.relationsContainer = container.createEl('div', { cls: 'shard-relations-section' });
    const relationsHeader = this.relationsContainer.createEl('h4', { text: 'Relations', cls: 'shard-section-header' });

    // Initial render
    await this.renderShardTree();
    await this.updateRelations();

    // Listen for active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        await this.updateRelations();
      })
    );

    // Listen for file modifications
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          await this.relationsManager.updateFileRelations(file);
          await this.renderShardTree();
          if (file === this.currentFile) {
            await this.updateRelations();
          }
        }
      })
    );

    // Listen for file creations
    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (file instanceof TFile) {
          await this.renderShardTree();
        }
      })
    );

    // Rebuild tree on major changes
    this.registerEvent(
      this.app.vault.on('rename', async () => await this.renderShardTree())
    );
    this.registerEvent(
      this.app.vault.on('delete', async () => await this.renderShardTree())
    );

    // Live update: listen for editor changes affecting shards blocks
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor: Editor, view: MarkdownView) => {
        if (!view || !editor) return;
        const content = editor.getValue();
        if (content.includes('```shards')) {
          if (this.debounceTimer) window.clearTimeout(this.debounceTimer);
          this.debounceTimer = window.setTimeout(async () => {
            await this.renderShardTree();
          }, 400);
        }
      })
    );
  }

  async renderShardTree() {
    if (!this.treeContainer) return;
    this.treeContainer.empty();

    const treeInner = this.treeContainer.createEl('div', { cls: 'tag-tree' });

    const files = this.app.vault.getMarkdownFiles();
    const shardTree: Record<string, ShardNode> = {};
    const filesInTree = new Set<string>();

    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const shards = this.parser.parseShardsFromContent(content);
      
      if (shards.length === 0) continue;
      
      shards.forEach(shard => {
        const parsed = this.parser.parseShard(shard);
        
        // Only process regular shards (not relations)
        if (parsed.type === 'regular') {
          const expandedShards = this.parser.expandMultiShard(parsed.value);
          expandedShards.forEach((expShard) => {
            const parts = expShard.split('/').filter(p => p.length > 0);
            
            if (parts.length === 0) return;
            
            // For single-level shards, add directly to root
            if (parts.length === 1) {
              if (!shardTree[parts[0]]) shardTree[parts[0]] = {};
              const node = shardTree[parts[0]];
              if (!node.files) node.files = [];
              node.files.push(file);
              filesInTree.add(file.path);
            } else {
              // For hierarchical shards, build the tree
              let current = shardTree;
              parts.forEach((part, index) => {
                if (!current[part]) current[part] = {};
                current = current[part];
                
                // Add file at the deepest level
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

    this.renderTree(shardTree, treeInner);

    const uncategorized = files.filter(f => !filesInTree.has(f.path));
    if (uncategorized.length > 0) {
      const uncategorizedSection = treeInner.createDiv({ cls: 'uncategorized-section' });
      uncategorizedSection.createEl('div', { text: 'Uncategorized', cls: 'uncategorized-header' });
      uncategorized.forEach(file => {
        const fileItem = uncategorizedSection.createDiv({ cls: 'tree-item nav-file' });
        const fileTitle = fileItem.createDiv({ cls: 'tree-item-self nav-file-title tappable is-clickable' });
        fileTitle.setAttribute('data-path', file.path);
        fileTitle.setAttribute('draggable', 'true');
        fileTitle.createDiv({ cls: 'tree-item-inner nav-file-title-content', text: file.basename });
        fileTitle.addEventListener('click', () => this.app.workspace.openLinkText(file.path, ''));
        if (this.currentFile && file.basename === this.currentFile.basename) {
          fileTitle.addClass('shard-current-file');
        }
      });
    }
  }

  async updateRelations() {
    if (!this.relationsContainer) return;
    this.relationsContainer.empty();

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== 'md') {
      this.currentFile = null;
      this.renderEmptyRelations();
      return;
    }

    this.currentFile = activeFile;
    const relations = await this.relationsManager.getFileRelations(activeFile);
    this.renderRelations(activeFile, relations);
  }

  renderEmptyRelations() {
    if (!this.relationsContainer) return;
    this.relationsContainer.createEl('div', { 
      cls: 'pane-empty',
      text: 'No markdown file open'
    });
  }

  renderRelations(file: TFile, relations: FileRelations) {
    if (!this.relationsContainer) return;

    // Current file header
    const headerEl = this.relationsContainer.createEl('div', { cls: 'relations-header' });
    headerEl.createEl('h5', { text: file.basename });

    // Parents section
    if (relations.parents.length > 0) {
      this.renderSection('↑ Parents', relations.parents, 'relation-parents');
    }

    // Related section
    if (relations.related.length > 0) {
      this.renderSection('↔ Related', relations.related, 'relation-related');
    }

    // Children section
    if (relations.children.length > 0) {
      this.renderSection('↓ Children', relations.children, 'relation-children');
    }

    // Show empty message if no relations
    if (relations.parents.length === 0 && 
        relations.related.length === 0 && 
        relations.children.length === 0) {
      this.relationsContainer.createEl('div', { 
        cls: 'pane-empty',
        text: 'No relations defined'
      });
    }
  }

  renderSection(title: string, files: TFile[], className: string) {
    if (!this.relationsContainer) return;
    const sectionEl = this.relationsContainer.createEl('div', { cls: `relations-section ${className}` });
    sectionEl.createEl('h6', { text: title });
    
    const listEl = sectionEl.createEl('div', { cls: 'relations-list' });
    
    files.forEach(file => {
      const itemEl = listEl.createEl('div', { 
        cls: 'tree-item nav-file'
      });
      
      const titleEl = itemEl.createEl('div', { 
        cls: 'tree-item-self nav-file-title is-clickable',
        text: file.basename
      });
      
      titleEl.addEventListener('click', () => {
        this.app.workspace.openLinkText(file.path, '');
      });
    });
  }

  renderTree(node: Record<string, any>, el: HTMLElement, depth = 0, path: string[] = []) {
    Object.keys(node).sort().forEach(key => {
      if (key === 'files') return;
      
      const currentPath = [...path, key];
      const treeItem = el.createDiv({ cls: 'tree-item nav-folder' });
      const titleDiv = treeItem.createDiv({ cls: 'tree-item-self nav-folder-title is-clickable mod-collapsible' });
      
      // Set data-path attribute
      titleDiv.setAttribute('data-path', currentPath.join('/'));
      titleDiv.setAttribute('draggable', 'true');
      
      // Calculate inline styles based on depth
      const basePadding = 8;
      const perLevelIndent = 16;
      const paddingStart = basePadding + (depth * perLevelIndent);
      const marginStart = depth > 0 ? -(depth * perLevelIndent) : 0;
      
      titleDiv.style.marginInlineStart = `${marginStart}px !important`;
      titleDiv.style.paddingInlineStart = `${paddingStart}px !important`;
      
      // Insert collapse icon as the first child inside the clickable container
      const collapseIcon = document.createElement('div');
      collapseIcon.className = 'tree-item-icon collapse-icon';
      collapseIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>';
      titleDiv.appendChild(collapseIcon);
      
      const titleContent = titleDiv.createDiv({ cls: 'tree-item-inner nav-folder-title-content', text: key });
      const childrenContainer = treeItem.createDiv({ cls: 'tree-item-children nav-folder-children' });
      
      // Toggle logic
      titleDiv.addEventListener('click', () => {
        const isCollapsed = treeItem.hasClass('is-collapsed');
        treeItem.toggleClass('is-collapsed', !isCollapsed);
        collapseIcon.toggleClass('is-collapsed', !isCollapsed);
      });
      
      // Render sub-tree first
      this.renderTree(node[key], childrenContainer, depth + 1, currentPath);
      
      // Render files
      if (node[key].files) {
        node[key].files.forEach((file: TFile) => {
          const fileItem = childrenContainer.createDiv({ cls: 'tree-item nav-file' });
          const fileTitle = fileItem.createDiv({ cls: 'tree-item-self nav-file-title tappable is-clickable' });
          
          // Set data-path and draggable for files
          fileTitle.setAttribute('data-path', file.path);
          fileTitle.setAttribute('draggable', 'true');
          
          // Calculate inline styles for files
          const fileDepth = depth + 1;
          const filePaddingStart = basePadding + (fileDepth * perLevelIndent);
          const fileMarginStart = -(fileDepth * perLevelIndent);
          
          fileTitle.style.marginInlineStart = `${fileMarginStart}px !important`;
          fileTitle.style.paddingInlineStart = `${filePaddingStart}px !important`;
          
          fileTitle.createDiv({ cls: 'tree-item-inner nav-file-title-content', text: file.basename });
          fileTitle.addEventListener('click', () => this.app.workspace.openLinkText(file.path, ''));

          // Highlight if this is the current file
          if (this.currentFile && file.basename === this.currentFile.basename) {
            fileTitle.addClass('shard-current-file');
          }
        });
      }
    });
  }

  async onClose() {
    // Cleanup if needed
  }
} 