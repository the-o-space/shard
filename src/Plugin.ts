import { Plugin, TFile } from 'obsidian';
import { Manager } from './Manager';
import { Settings } from './data/types/Settings';
import { ShardView, VIEW_TYPE } from './views/ShardView';
import { rootStore, rootInitialState } from './state/rootStore';

export default class ShardPlugin extends Plugin {
	settings: Settings;
	manager: Manager;

	async onload() {
		this.manager = new Manager(this.app, this.app.vault, this.app.metadataCache);

		await this.setupSettings();
		
		// Register the view
		this.registerView(
			VIEW_TYPE,
			(leaf) => new ShardView(leaf, this.manager)
		);
		
		this.app.workspace.onLayoutReady(async () => {
			await this.manager.parseAllFiles();
		});

		this.registerEvent(
			this.app.metadataCache.on('changed', async (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					await this.manager.reparseFile(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.manager.removeFile(file);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					const oldFile = this.app.vault.getAbstractFileByPath(oldPath) as TFile;
					this.manager.renameFile(oldFile, file);
				}
			})
		);

		this.addCommand({
			id: 'open-shard-view',
			name: 'Open Shards',
			callback: () => {
				this.activateShards();
			}
		});
	}

	async setupSettings() {
		this.settings = await this.loadData();
		const saved = (await this.loadData()) as any;
		if (saved && saved.ui) {
			rootStore.dispatch({ type: 'ui/set', payload: saved.ui });
		}
	}

	async activateShards() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(leaves[0]);
		} else {
			const leaf = this.app.workspace.getLeftLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE });
				this.app.workspace.revealLeaf(leaf);
			}
		}
	}

	onunload() {
		// Clean up the view
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
		const data = (this.settings as any) ?? {};
		const state = rootStore.getState();
		(data as any).ui = state.ui;
		this.saveData(data);
	}
}
