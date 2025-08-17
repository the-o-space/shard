import { TFile, Vault } from 'obsidian';
import { FileRelations, RelationMaps } from './types';
import { ShardParser } from './parser';

export class RelationsManager {
  private vault: Vault;
  private parser: ShardParser;
  private relationsCache: Map<string, FileRelations> = new Map();
  private inverseRelations: RelationMaps = {
    related: new Map(),
    parents: new Map(),
    children: new Map()
  };

  constructor(vault: Vault) {
    this.vault = vault;
    this.parser = new ShardParser();
  }

  async rebuildRelationsCache() {
    this.relationsCache.clear();
    this.inverseRelations = {
      related: new Map(),
      parents: new Map(),
      children: new Map()
    };

    const files = this.vault.getMarkdownFiles();
    
    // First pass: parse all relations
    for (const file of files) {
      const content = await this.vault.read(file);
      const shards = this.parser.parseShardsFromContent(content);
      const relations: FileRelations = {
        related: [],
        parents: [],
        children: []
      };

      for (const shardStr of shards) {
        const parsed = this.parser.parseShard(shardStr);
        
        if (parsed.type !== 'regular' && parsed.cleanName) {
          const targetFile = this.findFileByName(parsed.cleanName);
          if (targetFile) {
            switch (parsed.type) {
              case 'related':
                relations.related.push(targetFile);
                break;
              case 'parent':
                relations.parents.push(targetFile);
                break;
              case 'child':
                relations.children.push(targetFile);
                break;
            }
          }
        }
      }

      this.relationsCache.set(file.path, relations);
    }

    // Second pass: build inverse relations
    for (const [filePath, relations] of this.relationsCache.entries()) {
      const file = this.vault.getAbstractFileByPath(filePath) as TFile;
      if (!file) continue;

      // Related is bidirectional
      relations.related.forEach(relatedFile => {
        this.addToInverseMap(this.inverseRelations.related, relatedFile.basename, file);
      });

      // Parent -> Child inverse
      relations.parents.forEach(parentFile => {
        this.addToInverseMap(this.inverseRelations.children, parentFile.basename, file);
      });

      // Child -> Parent inverse
      relations.children.forEach(childFile => {
        this.addToInverseMap(this.inverseRelations.parents, childFile.basename, file);
      });
    }
  }

  private addToInverseMap(map: Map<string, TFile[]>, key: string, file: TFile) {
    if (!map.has(key)) {
      map.set(key, []);
    }
    const list = map.get(key)!;
    if (!list.includes(file)) {
      list.push(file);
    }
  }

  async getFileRelations(file: TFile): Promise<FileRelations> {
    // Get direct relations from cache
    const directRelations = this.relationsCache.get(file.path) || {
      related: [],
      parents: [],
      children: []
    };

    // Get inverse relations
    const inverseRelated = this.inverseRelations.related.get(file.basename) || [];
    const inverseParents = this.inverseRelations.parents.get(file.basename) || [];
    const inverseChildren = this.inverseRelations.children.get(file.basename) || [];

    // Merge relations (avoiding duplicates)
    const allRelated = new Set([...directRelations.related, ...inverseRelated]);
    const allParents = new Set([...directRelations.parents, ...inverseParents]);
    const allChildren = new Set([...directRelations.children, ...inverseChildren]);

    return {
      related: Array.from(allRelated),
      parents: Array.from(allParents),
      children: Array.from(allChildren)
    };
  }

  async updateFileRelations(file: TFile) {
    const content = await this.vault.read(file);
    const shards = this.parser.parseShardsFromContent(content);
    const relations: FileRelations = {
      related: [],
      parents: [],
      children: []
    };

    const oldRelations = this.relationsCache.get(file.path) || {
      related: [],
      parents: [],
      children: []
    };

    // Remove old inverse relations for this file
    this.removeFileFromInverseRelations(file);

    for (const shardStr of shards) {
      const parsed = this.parser.parseShard(shardStr);
      
      if (parsed.type !== 'regular' && parsed.cleanName) {
        const targetFile = this.findFileByName(parsed.cleanName);
        if (targetFile) {
          switch (parsed.type) {
            case 'related':
              relations.related.push(targetFile);
              this.addToInverseMap(this.inverseRelations.related, targetFile.basename, file);
              break;
            case 'parent':
              relations.parents.push(targetFile);
              this.addToInverseMap(this.inverseRelations.children, targetFile.basename, file);
              break;
            case 'child':
              relations.children.push(targetFile);
              this.addToInverseMap(this.inverseRelations.parents, targetFile.basename, file);
              break;
          }
        }
      }
    }

    this.relationsCache.set(file.path, relations);

    // Write symmetric relations to linked files
    await this.writeSymmetricRelations(file, relations, oldRelations);
  }

  private async writeSymmetricRelations(
    sourceFile: TFile, 
    newRelations: FileRelations, 
    oldRelations: FileRelations
  ) {
    // Find new relations that need to be added
    const newRelated = newRelations.related.filter(f => !oldRelations.related.includes(f));
    const newParents = newRelations.parents.filter(f => !oldRelations.parents.includes(f));
    const newChildren = newRelations.children.filter(f => !oldRelations.children.includes(f));

    // Find relations that need to be removed
    const removedRelated = oldRelations.related.filter(f => !newRelations.related.includes(f));
    const removedParents = oldRelations.parents.filter(f => !newRelations.parents.includes(f));
    const removedChildren = oldRelations.children.filter(f => !newRelations.children.includes(f));

    // Add symmetric relations
    for (const targetFile of newRelated) {
      await this.addShardToFile(targetFile, `= [[${sourceFile.basename}]]`);
    }
    
    for (const parentFile of newParents) {
      await this.addShardToFile(parentFile, `< [[${sourceFile.basename}]]`);
    }
    
    for (const childFile of newChildren) {
      await this.addShardToFile(childFile, `> [[${sourceFile.basename}]]`);
    }

    // Remove symmetric relations
    for (const targetFile of removedRelated) {
      await this.removeShardFromFile(targetFile, `= [[${sourceFile.basename}]]`);
    }
    
    for (const parentFile of removedParents) {
      await this.removeShardFromFile(parentFile, `< [[${sourceFile.basename}]]`);
    }
    
    for (const childFile of removedChildren) {
      await this.removeShardFromFile(childFile, `> [[${sourceFile.basename}]]`);
    }
  }

  private async addShardToFile(file: TFile, shardLine: string) {
    const content = await this.vault.read(file);
    
    // Check if the shard already exists
    const existingShards = this.parser.parseShardsFromContent(content);
    if (existingShards.includes(shardLine)) {
      return; // Already exists
    }

    // Find or create shards code block
    const codeBlockRegex = /```shards\n([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);
    
    if (match) {
      // Add to existing code block
      const blockStart = match.index!;
      const blockEnd = blockStart + match[0].length;
      const blockContent = match[1];
      
      // Add the new shard line
      const newBlockContent = blockContent.trimEnd() + '\n' + shardLine + '\n';
      const newContent = content.slice(0, blockStart) + 
                        '```shards\n' + newBlockContent + '```' + 
                        content.slice(blockEnd);
      
      await this.vault.modify(file, newContent);
    } else {
      const frontmatterRegex = /^(---\n[\s\S]*?\n---\n?)/;
      const fmMatch = content.match(frontmatterRegex);
      const shardsBlock = '```shards\n' + shardLine + '\n```\n\n';
      let newContent;
      if (fmMatch) {
        // Insert after frontmatter
        const fmEnd = fmMatch[0].length;
        newContent = content.slice(0, fmEnd) + shardsBlock + content.slice(fmEnd);
      } else {
        // Insert at very top
        newContent = shardsBlock + content;
      }
      await this.vault.modify(file, newContent);
    }
  }

  private async removeShardFromFile(file: TFile, shardLine: string) {
    const content = await this.vault.read(file);
    const codeBlockRegex = /```shards\n([\s\S]*?)```/g;
    let newContent = content;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const blockStart = match.index!;
      const blockEnd = blockStart + match[0].length;
      const blockContent = match[1];
      
      // Split into lines and filter out the shard to remove
      const lines = blockContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && line !== shardLine);
      
      if (lines.length === 0) {
        // Remove the entire code block if empty
        newContent = content.slice(0, blockStart).trimEnd() + 
                    content.slice(blockEnd);
      } else {
        // Update the code block with remaining shards
        const newBlockContent = lines.join('\n') + '\n';
        newContent = content.slice(0, blockStart) + 
                    '```shards\n' + newBlockContent + '```' + 
                    content.slice(blockEnd);
      }
      
      break; // Only process the first shards block
    }
    
    if (newContent !== content) {
      await this.vault.modify(file, newContent);
    }
  }

  private removeFileFromInverseRelations(file: TFile) {
    // Remove file from all inverse relation maps
    const removeFromMap = (map: Map<string, TFile[]>) => {
      for (const [key, files] of map.entries()) {
        const index = files.indexOf(file);
        if (index > -1) {
          files.splice(index, 1);
          if (files.length === 0) {
            map.delete(key);
          }
        }
      }
    };

    removeFromMap(this.inverseRelations.related);
    removeFromMap(this.inverseRelations.parents);
    removeFromMap(this.inverseRelations.children);
  }

  private findFileByName(name: string): TFile | null {
    const files = this.vault.getMarkdownFiles();
    return files.find(f => f.basename === name) || null;
  }

  getRelationMaps(): RelationMaps {
    return this.inverseRelations;
  }
} 