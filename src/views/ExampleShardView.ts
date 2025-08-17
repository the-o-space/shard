import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Manager } from '../Manager';
import { buildRelationsPanel } from '../ui/Relations';
import { buildShardTree } from '../ui/Tree';
import { TreeNode } from '../Tree';

export const VIEW_TYPE = 'shard-example-view';

/**
 * Example view showing how to use Manager with UI components
 */
export class ExampleShardView extends ItemView {
    private manager: Manager;
    private currentFile: TFile | null = null;

    constructor(leaf: WorkspaceLeaf, manager: Manager) {
        super(leaf);
        this.manager = manager;
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Shards';
    }

    async onOpen() {
        // Set initial file to the active file
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.currentFile = activeFile;
        }
        
        // Register event to track active file changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                const newFile = this.app.workspace.getActiveFile();
                if (newFile && newFile !== this.currentFile) {
                    this.setCurrentFile(newFile);
                }
            })
        );
        
        this.render();
    }

    setCurrentFile(file: TFile | null) {
        this.currentFile = file;
        this.render();
    }

    private render() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('shard-view');

        // Create tabs
        const tabContainer = container.createDiv({ cls: 'shard-tabs' });
        const relationsTab = tabContainer.createEl('button', { 
            text: 'Relations', 
            cls: 'shard-tab active' 
        });
        const treeTab = tabContainer.createEl('button', { 
            text: 'Tree', 
            cls: 'shard-tab' 
        });

        // Create content area
        const contentArea = container.createDiv({ cls: 'shard-content' });

        // Show relations by default
        this.renderRelations(contentArea);

        // Tab switching
        relationsTab.addEventListener('click', () => {
            relationsTab.addClass('active');
            treeTab.removeClass('active');
            contentArea.empty();
            this.renderRelations(contentArea);
        });

        treeTab.addEventListener('click', () => {
            treeTab.addClass('active');
            relationsTab.removeClass('active');
            contentArea.empty();
            this.renderTree(contentArea);
        });
    }

    private renderRelations(container: HTMLElement) {
        const graph = this.manager.getGraph();
        
        if (!this.currentFile) {
            container.createEl('p', { text: 'Select a file to view relations' });
            return;
        }

        const allRelations = graph.getAllRelationsForFile(this.currentFile);
        
        // Separate into outgoing and incoming
        const outgoing = allRelations.filter(r => r.source === this.currentFile);
        const incoming = allRelations.filter(r => r.target === this.currentFile);

        const relationsPanel = buildRelationsPanel(
            { outgoing, incoming },
            this.currentFile,
            (file) => this.setCurrentFile(file),
            (evt, file) => this.onFileContextMenu(evt, file),
            this.app
        );

        container.appendChild(relationsPanel);
    }

    private renderTree(container: HTMLElement) {
        const tree = this.manager.getTree();
        const treeRep = tree.buildTreeRepresentation();
        
        // Convert TreeNode to format expected by UI
        const uiTree = this.convertTreeNodeToUIFormat(treeRep);

        const treePanel = buildShardTree(
            uiTree,
            this.currentFile,
            (evt, path) => this.onCategoryContextMenu(evt, path),
            (evt, file) => this.onFileContextMenu(evt, file),
            this.app
        );

        container.appendChild(treePanel);
    }

    private convertTreeNodeToUIFormat(node: TreeNode): Record<string, any> {
        const result: Record<string, any> = {};
        
        // Add children
        for (const [name, child] of node.children) {
            result[name] = this.convertTreeNodeToUIFormat(child);
        }
        
        // Add files if present
        if (node.files && node.files.length > 0) {
            result.files = node.files;
        }
        
        return result;
    }

    private onFileContextMenu(evt: MouseEvent, file: TFile) {
        // Handle file context menu
        console.log('File context menu:', file.path);
    }

    private onCategoryContextMenu(evt: MouseEvent, path: string) {
        // Handle category context menu
        console.log('Category context menu:', path);
    }
}