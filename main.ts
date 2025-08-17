import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { ShardView, VIEW_TYPE_SHARD_FILE } from './src/views/ShardView';
import { RelationsManager } from './src/model/RelationsManager';
import { ViewStateManager, ShardViewState } from './src/model/ViewStateManager';
import { CustomSection } from './src/types';

interface ShardPluginSettings {
	replaceFileExplorer: boolean;
	customSections: CustomSection[];
	viewState?: ShardViewState;
}

const DEFAULT_SETTINGS: ShardPluginSettings = {
	replaceFileExplorer: true,
	customSections: []
}

export default class ShardPlugin extends Plugin {
	settings: ShardPluginSettings;
	relationsManager: RelationsManager;
	viewStateManager: ViewStateManager;

	async onload() {
		await this.loadSettings();

		this.relationsManager = new RelationsManager(this.app.vault);
		
		// Initialize ViewStateManager with persistent state
		this.viewStateManager = new ViewStateManager(
			this.settings.viewState,
			async () => {
				this.settings.viewState = this.viewStateManager.getState();
				await this.saveSettings();
			}
		);

		this.registerView(VIEW_TYPE_SHARD_FILE, (leaf) => new ShardView(
			leaf,
			this.relationsManager,
			this.viewStateManager,
			this.settings.customSections
		));

		this.app.workspace.onLayoutReady(async () => {
			await this.relationsManager.rebuildRelationsCache();
			if (this.settings.replaceFileExplorer) {
				this.replaceFileExplorer();
			}
		});

		this.addCommand({
			id: 'open-shard-view',
			name: 'Open Shard View',
			callback: () => {
				this.activateShardView();
			}
		});

		this.addCommand({
			id: 'delete-current-file',
			name: 'Delete current file',
			hotkeys: [
				{ modifiers: ['Mod'], key: 'Delete' }
			],
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) this.safeDelete(file);
				return true;
			}
		});

		this.addSettingTab(new ShardSettingTab(this.app, this));
	}

	async safeDelete(file: TFile) {
		await this.relationsManager.cleanupDeletedFileRelations(file);
		await this.app.vault.delete(file);
		new Notice(`Deleted: ${file.basename}`);
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

		new Setting(containerEl)
			.setName('Custom Sections')
			.setDesc('Define your custom sections in JSON. Example:')
			.setClass('custom-sections-setting')
			.addTextArea(text => {
				text.inputEl.style.width = '100%';
				text.inputEl.style.height = '8em';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				let draft = JSON.stringify(this.plugin.settings.customSections, null, 2);
				text.setValue(draft);
				text.onChange((value) => {
					draft = value; // just cache, do not save yet
				});
			})
			.addExtraButton(btn => {
				btn.setIcon('save')
				   .setTooltip('Save sections')
				   .onClick(async () => {
					   try {
						   const parsed: CustomSection[] = JSON.parse((document.querySelector('.custom-sections-setting textarea') as HTMLTextAreaElement).value);
						   this.plugin.settings.customSections = parsed;
						   await this.plugin.saveSettings();
						   new Notice('Custom sections saved');
					   } catch (err) {
						   new Notice('Invalid JSON – not saved');
						   console.error('Invalid JSON for custom sections', err);
					   }
				   });
			});
	}
}
