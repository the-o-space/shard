import { TFile, Menu, App } from 'obsidian';

export class ContextMenuManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Show context menu for shard categories/folders
   */
  showCategoryContextMenu(evt: MouseEvent, shardPath: string): void {
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

  /**
   * Show context menu for files
   */
  showFileContextMenu(evt: MouseEvent, file: TFile): void {
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

  /**
   * Create a new note in the specified shard category
   */
  private async createNoteInCategory(shardPath: string): Promise<void> {
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
} 