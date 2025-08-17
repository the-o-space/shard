import { ItemView, WorkspaceLeaf, TFile, ViewStateResult } from 'obsidian';
import { Manager } from '../Manager';
import { buildRelationsPanel } from '../ui/Relations';
import { buildShardTree } from '../ui/Tree';
import { TreeNode } from '../Tree';
// no-op

export const VIEW_TYPE = 'shard-view';

type ShardViewState = {
    expandedPaths: string[];
    treeScrollTop: number;
    relationsScrollTop: number;
    treeCollapsed: boolean;
    relationsCollapsed: boolean;
    treeHeightPx: number | null;
};

export class ShardView extends ItemView {
    private manager: Manager;
    private currentFile: TFile | null = null;
    private treeSectionHeightPx: number | null = null;
    private state: ShardViewState = {
        expandedPaths: [],
        treeScrollTop: 0,
        relationsScrollTop: 0,
        treeCollapsed: false,
        relationsCollapsed: false,
        treeHeightPx: null
    };

    constructor(leaf: WorkspaceLeaf, manager: Manager) {
        super(leaf);
        this.manager = manager;
    }

    getViewType(): string { return VIEW_TYPE; }
    getDisplayText(): string { return 'Shards'; }

    // Persist view state via Obsidian's APIs
    getState(): any {
        return this.state;
    }

    async setState(state: any, _result?: ViewStateResult): Promise<void> {
        this.state = { ...this.state, ...(state || {}) };
        this.treeSectionHeightPx = this.state.treeHeightPx;
        this.render();
    }

    async onOpen() {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) this.currentFile = activeFile;

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                const newFile = this.app.workspace.getActiveFile();
                if (newFile && newFile !== this.currentFile) this.setCurrentFile(newFile);
            })
        );

        const unsubscribe = this.manager.onUpdated(() => this.render());
        this.register(() => unsubscribe());
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

        const sectionsContainer = container.createDiv({ cls: 'shard-view-container' });

        const treeSection = sectionsContainer.createDiv({ cls: 'shard-section shard-tree-section' });
        const treeHeader = treeSection.createDiv({ cls: 'shard-section-header nav-header' });
        treeHeader.createSpan({ text: 'Tree' });
        const treeContent = treeSection.createDiv({ cls: 'shard-section-content' });
        this.renderTree(treeContent);
        // Apply initial collapsed state from view state
        if (this.state.treeCollapsed) treeSection.addClass('is-collapsed');
        treeHeader.addEventListener('mousedown', (evt) => {
            if (evt.button !== 0) return;
            const willCollapse = !treeSection.hasClass('is-collapsed');
            treeSection.toggleClass('is-collapsed', willCollapse);
            this.state.treeCollapsed = willCollapse;
            this.app.workspace.requestSaveLayout();
        });

        const splitter = sectionsContainer.createDiv({ cls: 'shard-splitter' });

        const relSection = sectionsContainer.createDiv({ cls: 'shard-section shard-relations-section' });
        const relHeader = relSection.createDiv({ cls: 'shard-section-header nav-header' });
        relHeader.createSpan({ text: 'Relations' });
        const relContent = relSection.createDiv({ cls: 'shard-section-content' });
        this.renderRelations(relContent);
        if (this.state.relationsCollapsed) relSection.addClass('is-collapsed');
        relHeader.addEventListener('mousedown', (evt) => {
            if (evt.button !== 0) return;
            const willCollapse = !relSection.hasClass('is-collapsed');
            relSection.toggleClass('is-collapsed', willCollapse);
            this.state.relationsCollapsed = willCollapse;
            this.app.workspace.requestSaveLayout();
        });

        const totalHeight = (sectionsContainer as HTMLElement).clientHeight || 400;
        const persistedHeight = typeof this.state.treeHeightPx === 'number' ? this.state.treeHeightPx : null;
        const initialTreeHeight = (persistedHeight ?? this.treeSectionHeightPx) ?? Math.round(totalHeight * 0.6);
        treeSection.style.flex = '0 0 auto';
        treeSection.style.height = `${initialTreeHeight}px`;
        treeSection.style.overflowY = 'auto';
        relSection.style.flex = '1 1 auto';
        relSection.style.overflowY = 'auto';

        // Restore and track scroll for relations section via persisted state
        relSection.scrollTop = this.state.relationsScrollTop || 0;
        relSection.addEventListener('scroll', () => {
            this.state.relationsScrollTop = relSection.scrollTop;
            this.app.workspace.requestSaveLayout();
        });

        // Restore and track scroll for the tree section (the actual scrollable container)
        treeSection.scrollTop = this.state.treeScrollTop || 0;
        treeSection.addEventListener('scroll', () => {
            this.state.treeScrollTop = treeSection.scrollTop;
            // Avoid spamming layout saves on every frame; omit or debounce as needed
        });

        let isDragging = false;
        let startY = 0;
        let startHeight = initialTreeHeight;

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dy = e.clientY - startY;
            const newHeight = Math.max(100, Math.min(totalHeight - 100, startHeight + dy));
            treeSection.style.height = `${newHeight}px`;
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.classList.remove('shard-resizing');
            const numeric = parseInt(treeSection.style.height || '0', 10);
            if (!Number.isNaN(numeric)) {
                this.treeSectionHeightPx = numeric;
                this.state.treeHeightPx = numeric;
                this.app.workspace.requestSaveLayout();
            }
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        splitter.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            startY = e.clientY;
            startHeight = parseInt(treeSection.style.height || `${initialTreeHeight}`, 10) || initialTreeHeight;
            document.body.classList.add('shard-resizing');
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    private renderRelations(container: HTMLElement) {
        const graph = this.manager.getGraph();
        if (!this.currentFile) {
            container.createEl('p', { text: 'Select a file to view relations' });
            return;
        }

        const allRelations = graph.getAllRelationsForFile(this.currentFile);
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
        const uiTree = this.convertTreeNodeToUIFormat(treeRep);
        const treePanel = buildShardTree(
            uiTree,
            this.currentFile,
            (evt, path) => this.onCategoryContextMenu(evt, path),
            (evt, file) => this.onFileContextMenu(evt, file),
            this.app,
            {
                expandedPaths: new Set<string>((this.state.expandedPaths as string[]) || []),
                initialScrollTop: 0,
                onToggleExpand: (path, expanded) => {
                    const set = new Set<string>((this.state.expandedPaths as string[]) || []);
                    if (expanded) set.add(path); else set.delete(path);
                    this.state.expandedPaths = Array.from(set);
                    this.app.workspace.requestSaveLayout();
                }
            }
        );
        container.appendChild(treePanel);
    }

    private convertTreeNodeToUIFormat(node: TreeNode): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [name, child] of node.children) result[name] = this.convertTreeNodeToUIFormat(child);
        if (node.files && node.files.length > 0) result.files = node.files;
        return result;
    }

    private onFileContextMenu(_evt: MouseEvent, file: TFile) {
        console.log('File context menu:', file.path);
    }

    private onCategoryContextMenu(_evt: MouseEvent, path: string) {
        console.log('Category context menu:', path);
    }
}


