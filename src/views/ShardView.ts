import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { RelationsManager } from '../model/RelationsManager';
import { ViewStateManager } from '../model/ViewStateManager';
import { buildRelationsPanel } from '../ui/Relations';
import { CustomSection } from '../types';
import { TreeBuilder } from '../services/TreeBuilder';
import { TreeRenderer } from '../services/TreeRenderer';
import { ContextMenuManager } from '../services/ContextMenuManager';
import { SectionRenderer } from '../services/SectionRenderer';

export const VIEW_TYPE_SHARD_FILE = 'shard-file-view';

export class ShardView extends ItemView {
  private relationsManager: RelationsManager;
  private viewStateManager: ViewStateManager;
  private treeBuilder: TreeBuilder;
  private treeRenderer: TreeRenderer;
  private contextMenuManager: ContextMenuManager;
  private sectionRenderer: SectionRenderer;
  private treeContainer: HTMLElement | null = null;
  private relationsContainer: HTMLElement | null = null;
  private currentFile: TFile | null = null;
  private customSections: CustomSection[];

  constructor(
    leaf: WorkspaceLeaf,
    relationsManager: RelationsManager,
    viewStateManager: ViewStateManager,
    customSections: CustomSection[] = []
  ) {
    super(leaf);
    this.relationsManager = relationsManager;
    this.viewStateManager = viewStateManager;
    this.customSections = customSections;
    
    this.treeBuilder = new TreeBuilder(this.app.vault);
    this.contextMenuManager = new ContextMenuManager(this.app);
    this.treeRenderer = new TreeRenderer(
      this.app,
      viewStateManager,
      (evt, path) => this.contextMenuManager.showCategoryContextMenu(evt, path),
      (evt, file) => this.contextMenuManager.showFileContextMenu(evt, file)
    );
    this.sectionRenderer = new SectionRenderer(viewStateManager);
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

    this.treeContainer = container.createDiv({ cls: 'shard-tree-section' });
    this.treeContainer.createEl('h4', { text: 'Shard Tree', cls: 'shard-section-header' });
    this.sectionRenderer.setContainer(this.treeContainer);

    this.relationsContainer = container.createDiv({ cls: 'shard-relations-section' });
    this.relationsContainer.createEl('h4', { text: 'Relations', cls: 'shard-section-header' });

    await this.renderAll();

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        this.currentFile = this.app.workspace.getActiveFile();
        this.treeRenderer.highlightActiveFileInTree(this.treeContainer!, this.currentFile);
        await this.renderRelations();
      })
    );

    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          await this.relationsManager.updateFileRelations(file);
          await this.updateTreeAndRelations();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (file instanceof TFile) {
          await this.updateTreeAndRelations();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', async () => await this.updateTreeAndRelations())
    );
    this.registerEvent(
      this.app.vault.on('rename', async () => await this.updateTreeAndRelations())
    );
  }

  async renderAll() {
    this.currentFile = this.app.workspace.getActiveFile();
    await this.renderShardTree();
    this.treeRenderer.highlightActiveFileInTree(this.treeContainer!, this.currentFile);
    await this.renderRelations();
  }

  private async updateTreeAndRelations() {
    await this.renderShardTree();
    this.treeRenderer.highlightActiveFileInTree(this.treeContainer!, this.currentFile);
    await this.renderRelations();
  }

  async renderShardTree() {
    if (!this.treeContainer) return;

    this.sectionRenderer.preserveCollapsedState(this.treeContainer);
    
    this.sectionRenderer.clearContainer();

    await this.sectionRenderer.renderSection('All Shards', async () => {
      const shardTree = await this.treeBuilder.buildAllShardsTree();
      return this.treeRenderer.renderTreeSection(shardTree, this.currentFile);
    });

    await this.sectionRenderer.renderSection('Unsharded', async () => {
      const files = await this.treeBuilder.getUnshardedFiles();
      return this.treeRenderer.renderFileList(files, this.currentFile, 'No unsharded notes');
    });

    for (const section of this.customSections) {
      try {
        await this.sectionRenderer.renderSection(section.name, async () => {
          const secTree = await this.treeBuilder.buildTreeForSection(section);
          return this.treeRenderer.renderTreeSection(secTree, this.currentFile);
        });
      } catch (e) {
        console.error(`Error rendering section ${section.name}`, e);
      }
    }
  }

  async renderRelations() {
    if (!this.relationsContainer) return;
    this.relationsContainer.empty();
    
    if (!this.currentFile || this.currentFile.extension !== 'md') {
      this.relationsContainer.createEl('div', { cls: 'pane-empty', text: 'No markdown file open' });
      return;
    }
    
    const relations = this.relationsManager.getFileRelations(this.currentFile);
    const panel = buildRelationsPanel(
      relations,
      this.currentFile,
      (file) => this.app.workspace.openLinkText(file.path, ''),
      (evt, file) => this.contextMenuManager.showFileContextMenu(evt, file),
      this.app
    );
    this.relationsContainer.appendChild(panel);
  }

  async onClose() {
  }
} 