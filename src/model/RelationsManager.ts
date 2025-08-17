import { TFile, Vault } from 'obsidian';
import { FileRelations, RelationMaps, RelationEntry } from '../types';
import { ShardParser } from './ShardParser';

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
            const entry: RelationEntry = { file: targetFile, label: parsed.label };
            switch (parsed.type) {
              case 'related':
                relations.related.push(entry);
                break;
              case 'parent':
                relations.parents.push(entry);
                break;
              case 'child':
                relations.children.push(entry);
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
      relations.related.forEach(entry => {
        this.addToInverseMap(this.inverseRelations.related, entry.file.basename, file);
      });
      // Parent -> Child inverse
      relations.parents.forEach(entry => {
        this.addToInverseMap(this.inverseRelations.children, entry.file.basename, file);
      });
      // Child -> Parent inverse
      relations.children.forEach(entry => {
        this.addToInverseMap(this.inverseRelations.parents, entry.file.basename, file);
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
    const directRelations = this.relationsCache.get(file.path) || {
      related: [],
      parents: [],
      children: []
    };
    const inverseRelatedFiles = this.inverseRelations.related.get(file.basename) || [];
    const inverseParentFiles = this.inverseRelations.parents.get(file.basename) || [];
    const inverseChildFiles = this.inverseRelations.children.get(file.basename) || [];

    const mergeEntries = (direct: RelationEntry[], inverseFiles: TFile[]): RelationEntry[] => {
      const map = new Map<string, RelationEntry>();
      direct.forEach(e => map.set(e.file.path, e));
      inverseFiles.forEach(f => {
        if (!map.has(f.path)) {
          map.set(f.path, { file: f });
        }
      });
      return Array.from(map.values());
    };

    return {
      related: mergeEntries(directRelations.related, inverseRelatedFiles),
      parents: mergeEntries(directRelations.parents, inverseParentFiles),
      children: mergeEntries(directRelations.children, inverseChildFiles)
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
          const entry: RelationEntry = { file: targetFile, label: parsed.label };
          switch (parsed.type) {
            case 'related':
              relations.related.push(entry);
              this.addToInverseMap(this.inverseRelations.related, targetFile.basename, file);
              break;
            case 'parent':
              relations.parents.push(entry);
              this.addToInverseMap(this.inverseRelations.children, targetFile.basename, file);
              break;
            case 'child':
              relations.children.push(entry);
              this.addToInverseMap(this.inverseRelations.parents, targetFile.basename, file);
              break;
          }
        }
      }
    }
    this.relationsCache.set(file.path, relations);

    // Helper to compute new and removed sets by file
    const filterNew = (cur: RelationEntry[], prev: RelationEntry[]) =>
      cur.filter(e => !prev.some(p => p.file === e.file));
    const filterRemoved = (prev: RelationEntry[], cur: RelationEntry[]) =>
      prev.filter(e => !cur.some(c => c.file === e.file));

    const newRelated = filterNew(relations.related, oldRelations.related);
    const newParents = filterNew(relations.parents, oldRelations.parents);
    const newChildren = filterNew(relations.children, oldRelations.children);
    const removedRelated = filterRemoved(oldRelations.related, relations.related);
    const removedParents = filterRemoved(oldRelations.parents, relations.parents);
    const removedChildren = filterRemoved(oldRelations.children, relations.children);

    for (const entry of newRelated) {
      await this.addShardToFile(entry.file, `= [[${file.basename}]]`);
    }
    for (const entry of newParents) {
      await this.addShardToFile(entry.file, `> [[${file.basename}]]`);
    }
    for (const entry of newChildren) {
      await this.addShardToFile(entry.file, `< [[${file.basename}]]`);
    }
    for (const entry of removedRelated) {
      await this.removeShardFromFile(entry.file, `= [[${file.basename}]]`);
    }
    for (const entry of removedParents) {
      await this.removeShardFromFile(entry.file, `> [[${file.basename}]]`);
    }
    for (const entry of removedChildren) {
      await this.removeShardFromFile(entry.file, `< [[${file.basename}]]`);
    }
  }

  private async addShardToFile(file: TFile, shardLine: string) {
    const content = await this.vault.read(file);
    // Parse target shard (used for comparison ignoring label)
    const targetParsed = this.parser.parseShard(shardLine);
    if (targetParsed.type === 'regular' || !targetParsed.cleanName) {
      // Fallback to old behaviour for unexpected input
      const existingShards = this.parser.parseShardsFromContent(content);
      if (existingShards.includes(shardLine)) {
        return;
      }
    } else {
      // Inspect existing shards to see if an equivalent relation already exists (label-agnostic)
      const existingShards = this.parser.parseShardsFromContent(content);
      const hasEquivalent = existingShards.some((line) => {
        const parsed = this.parser.parseShard(line);
        return (
          parsed.type === targetParsed.type &&
          parsed.cleanName === targetParsed.cleanName
        );
      });
      if (hasEquivalent) {
        return; // Equivalent relation already present – do not add duplicate
      }
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
    const targetParsed = this.parser.parseShard(shardLine);
    const codeBlockRegex = /```shards\n([\s\S]*?)```/g;
    let newContent = content;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const blockStart = match.index!;
      const blockEnd = blockStart + match[0].length;
      const blockContent = match[1];
      // Split into lines and filter out shards matching the target (ignoring label)
      const lines = blockContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const remaining = lines.filter((line) => {
        if (!targetParsed.cleanName || targetParsed.type === 'regular') return line !== shardLine;
        const parsed = this.parser.parseShard(line);
        return !(
          parsed.type === targetParsed.type &&
          parsed.cleanName === targetParsed.cleanName
        );
      });

      if (remaining.length === lines.length) {
        continue; // Nothing removed from this block – skip
      }

      if (remaining.length === 0) {
        // Remove entire code block if empty
        newContent = content.slice(0, blockStart).trimEnd() + content.slice(blockEnd);
      } else {
        const newBlockContent = remaining.join('\n') + '\n';
        newContent =
          content.slice(0, blockStart) +
          '```shards\n' +
          newBlockContent +
          '```' +
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

  async cleanupDeletedFileRelations(deletedFile: TFile) {
    // Get all files that reference the deleted file
    const relatedFiles = this.inverseRelations.related.get(deletedFile.basename) || [];
    const parentFiles = this.inverseRelations.parents.get(deletedFile.basename) || [];
    const childFiles = this.inverseRelations.children.get(deletedFile.basename) || [];
    
    // Remove references to the deleted file from all related files
    for (const file of relatedFiles) {
      await this.removeShardFromFile(file, `= [[${deletedFile.basename}]]`);
    }
    for (const file of parentFiles) {
      await this.removeShardFromFile(file, `> [[${deletedFile.basename}]]`);
    }
    for (const file of childFiles) {
      await this.removeShardFromFile(file, `< [[${deletedFile.basename}]]`);
    }
    
    // Remove the deleted file from all caches
    this.relationsCache.delete(deletedFile.path);
    this.removeFileFromInverseRelations(deletedFile);
    
    // Also remove as target from any inverse relations
    this.inverseRelations.related.delete(deletedFile.basename);
    this.inverseRelations.parents.delete(deletedFile.basename);
    this.inverseRelations.children.delete(deletedFile.basename);
  }
} 