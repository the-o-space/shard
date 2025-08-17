import { TFile, Vault } from 'obsidian';
import { ShardParser } from '../model/ShardParser';
import { CustomSection } from '../types';

export class TreeBuilder {
  private parser: ShardParser;
  private vault: Vault;

  constructor(vault: Vault) {
    this.parser = new ShardParser();
    this.vault = vault;
  }

  /**
   * Build the main shard tree containing all sharded files
   */
  async buildAllShardsTree(): Promise<Record<string, any>> {
    const files = this.vault.getMarkdownFiles();
    const shardTree: Record<string, any> = {};

    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const shards = this.parser.parseShardsFromContent(content);
      if (shards.length === 0) continue;
      
      shards.forEach((shard: string) => {
        const parsed = this.parser.parseShard(shard);
        if (parsed.type === 'regular') {
          const expandedShards = this.parser.expandMultiShard(parsed.value);
          expandedShards.forEach((expShard: string) => {
            this.addFileToTree(shardTree, expShard, file);
          });
        }
      });
    }
    
    return shardTree;
  }

  /**
   * Build a shard tree for a custom section based on its query
   */
  async buildTreeForSection(section: CustomSection): Promise<Record<string, any>> {
    const files = this.vault.getMarkdownFiles();
    const tree: Record<string, any> = {};
    
    for (const file of files) {
      if (!(await this.fileMatchesSection(file, section))) continue;

      const content = await this.vault.cachedRead(file);
      const shardLines = this.parser.parseShardsFromContent(content);
      
      for (const shard of shardLines) {
        const parsed = this.parser.parseShard(shard);
        if (parsed.type !== 'regular') continue;

        const expanded = this.parser.expandMultiShard(parsed.value);
        for (const expShard of expanded) {
          const include = this.shardMatchesQuery(expShard, section.query);
          if (!include) continue;

          this.addFileToTree(tree, expShard, file);
        }
      }
    }
    
    return tree;
  }

  /**
   * Get all unsharded markdown files
   */
  async getUnshardedFiles(): Promise<TFile[]> {
    const files = this.vault.getMarkdownFiles();
    const result: TFile[] = [];
    
    for (const file of files) {
      const content = await this.vault.cachedRead(file);
      const shards = this.parser.parseShardsFromContent(content);
      const hasRegular = shards.some((s) => this.parser.parseShard(s).type === 'regular');
      if (!hasRegular) {
        result.push(file);
      }
    }
    
    return result;
  }

  /**
   * Check if a file matches a custom section's criteria
   */
  private async fileMatchesSection(file: TFile, section: CustomSection): Promise<boolean> {
    const content = await this.vault.cachedRead(file);
    const shardLines = this.parser.parseShardsFromContent(content);
    const expandedShards: string[] = [];
    
    shardLines.forEach((line) => {
      const parsed = this.parser.parseShard(line);
      if (parsed.type === 'regular') {
        this.parser.expandMultiShard(parsed.value)
          .forEach((exp) => expandedShards.push(exp));
      }
    });

    if (typeof section.query !== 'string') {
      console.warn(`Skipping section ${section.name}: no query defined`);
      return false;
    }
    
    const query = section.query.trim();
    if (!query) {
      console.warn(`Skipping section ${section.name}: empty query`);
      return false;
    }
    
    const operator = query.includes('||') ? 'OR' : query.includes('&') ? 'AND' : 'OR';
    const rawTokens = operator === 'OR' ? query.split('||') : query.split('&');
    const tokens = rawTokens.map((t) => t.trim()).filter((t) => t.length > 0);

    if (tokens.length === 0) return false;

    const tokenMatchesPath = (token: string, shardPath: string): boolean => {
      if (token === shardPath) return true;
      return shardPath.startsWith(token + '/');
    };

    if (operator === 'OR') {
      return tokens.some((tok) => expandedShards.some((sp) => tokenMatchesPath(tok, sp)));
    } else {
      return tokens.every((tok) => expandedShards.some((sp) => tokenMatchesPath(tok, sp)));
    }
  }

  /**
   * Check if a shard path matches a query
   */
  private shardMatchesQuery(shardPath: string, query: string): boolean {
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) return false;
    
    const operator = q.includes('||') ? 'OR' : q.includes('&') ? 'AND' : 'OR';
    const rawTokens = operator === 'OR' ? q.split('||') : q.split('&');
    const tokens = rawTokens.map((t) => t.trim()).filter((t) => t.length > 0);
    
    const tokenMatches = (token: string, path: string) => 
      path === token || path.startsWith(token + '/');
    
    if (operator === 'OR') {
      return tokens.some((tok) => tokenMatches(tok, shardPath));
    } else {
      return tokens.every((tok) => tokenMatches(tok, shardPath));
    }
  }

  /**
   * Add a file to a shard tree at the specified path
   */
  private addFileToTree(tree: Record<string, any>, shardPath: string, file: TFile): void {
    const parts = shardPath.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) return;
    
    let current = tree;
    parts.forEach((part, index) => {
      if (!current[part]) current[part] = {};
      current = current[part];
      if (index === parts.length - 1) {
        if (!current.files) current.files = [];
        current.files.push(file);
      }
    });
  }
} 