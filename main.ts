import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { ShardFileView, VIEW_TYPE_SHARD_FILE } from './src/shardFileView';
import { RelationsManager } from './src/relationsManager';

interface ShardPluginSettings {
	replaceFileExplorer: boolean;
}

const DEFAULT_SETTINGS: ShardPluginSettings = {
	replaceFileExplorer: true
}

export default class ShardPlugin extends Plugin {
	settings: ShardPluginSettings;
	relationsManager: RelationsManager;
	private isUpdatingRelations = false;

	async onload() {
		await this.loadSettings();

		// Initialize relations manager
		this.relationsManager = new RelationsManager(this.app.vault);

		// Register view with relations manager
		this.registerView(VIEW_TYPE_SHARD_FILE, (leaf) => new ShardFileView(leaf, this.relationsManager));

		this.app.workspace.onLayoutReady(async () => {
			// Build initial relations cache
			await this.relationsManager.rebuildRelationsCache();

			if (this.settings.replaceFileExplorer) {
				this.replaceFileExplorer();
			}
		});

		// Update relations when files are modified
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				// Avoid infinite loops when we're updating relations
				if (this.isUpdatingRelations) return;
				
				if (file instanceof TFile && file.extension === 'md') {
					this.isUpdatingRelations = true;
					try {
						await this.relationsManager.updateFileRelations(file);
					} finally {
						this.isUpdatingRelations = false;
					}
				}
			})
		);

		// Update relations when files are created
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Wait a bit for the file to be ready
					setTimeout(async () => {
						await this.relationsManager.updateFileRelations(file);
					}, 100);
				}
			})
		);

		// Update relations when files are renamed
		this.registerEvent(
			this.app.vault.on('rename', async (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') {
					await this.relationsManager.rebuildRelationsCache();
				}
			})
		);

		// Update relations when files are deleted
		this.registerEvent(
			this.app.vault.on('delete', async (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					await this.relationsManager.rebuildRelationsCache();
				}
			})
		);

		this.addCommand({
			id: 'open-shard-view',
			name: 'Open Shard View',
			callback: () => {
				this.activateShardView();
			}
		});

		this.addCommand({
			id: 'sync-all-relations',
			name: 'Sync All Symmetric Relations',
			callback: async () => {
				new Notice('Syncing all symmetric relations...');
				await this.syncAllRelations();
				new Notice('Symmetric relations synced!');
			}
		});

		this.addSettingTab(new ShardSettingTab(this.app, this));
	}

	async syncAllRelations() {
		this.isUpdatingRelations = true;
		try {
			const files = this.app.vault.getMarkdownFiles();
			for (const file of files) {
				await this.relationsManager.updateFileRelations(file);
			}
		} finally {
			this.isUpdatingRelations = false;
		}
	}

	replaceFileExplorer() {
		const explorerLeaves = this.app.workspace.getLeavesOfType('file-explorer');
		explorerLeaves.forEach((leaf) => leaf.detach());
		const leftLeaf = this.app.workspace.getLeftLeaf(false);
		
		if (leftLeaf) {
			leftLeaf.setViewState({ type: VIEW_TYPE_SHARD_FILE });
			this.app.workspace.revealLeaf(leftLeaf);
		} else {
			console.error('No left leaf found');
		}
	}

	async activateShardView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SHARD_FILE);
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(leaves[0]);
		} else {
			const leaf = this.app.workspace.getLeftLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_SHARD_FILE });
				this.app.workspace.revealLeaf(leaf);
			}
		}
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ShardSettingTab extends PluginSettingTab {
	plugin: ShardPlugin;

	constructor(app: App, plugin: ShardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Replace Default File Explorer')
			.setDesc('Replace the default file explorer with shard view on startup.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.replaceFileExplorer)
				.onChange(async (value) => {
					this.plugin.settings.replaceFileExplorer = value;
					await this.plugin.saveSettings();
				}));
	}
}
