import { TFile, Vault } from 'obsidian';
import { Relation, RelationType } from '../domain/Relation';
import { RelationGraph } from '../domain/RelationGraph';
import { RelationEventBus, RelationEventHandler } from '../domain/RelationEvents';
import { RelationCommandProcessor } from '../services/RelationCommandProcessor';
import { SyncRelationsCommand, AddRelationCommand, RemoveRelationCommand } from '../domain/RelationCommands';
import { ShardParser } from './ShardParser';

/**
 * Main facade for the relations system
 */
export class RelationsManager {
  private vault: Vault;
  private eventBus: RelationEventBus;
  private commandProcessor: RelationCommandProcessor;
  private parser: ShardParser;

  constructor(vault: Vault) {
    this.vault = vault;
    this.eventBus = new RelationEventBus();
    this.commandProcessor = new RelationCommandProcessor(vault, this.eventBus, {
      conflictStrategy: 'prefer-non-empty',
      enableBidirectionalSync: true,
      showNotifications: false
    });
    this.parser = new ShardParser();
  }

  /**
   * Get the relation graph
   */
  getGraph(): RelationGraph {
    return this.commandProcessor.getGraph();
  }

  /**
   * Rebuild the entire relations cache from vault files
   */
  async rebuildRelationsCache(): Promise<void> {
    await this.commandProcessor.rebuildGraph();
  }

  /**
   * Get relations for a specific file
   */
  getFileRelations(file: TFile): {
    asSource: Relation[];
    asTarget: Relation[];
  } {
    return this.getGraph().getAllRelationsForFile(file);
  }

  /**
   * Update relations for a specific file by parsing its content
   */
  async updateFileRelations(file: TFile): Promise<void> {
    const content = await this.vault.read(file);
    const shardLines = this.parser.parseShardsFromContent(content);
    
    // Convert parsed shards to relations
    const parsedRelations: Array<{
      targetFile: TFile;
      type: RelationType;
      label?: string;
    }> = [];

    for (const shardLine of shardLines) {
      const shard = this.parser.parseShard(shardLine);
      if (shard.type === 'related' || shard.type === 'parent' || shard.type === 'child') {
        const targetFile = this.findFileByName(shard.cleanName || shard.value);
        if (targetFile) {
          parsedRelations.push({
            targetFile,
            type: this.mapShardTypeToRelationType(shard.type),
            label: shard.label
          });
        }
      }
    }

    // Create and execute sync command
    const command = new SyncRelationsCommand(file, parsedRelations);
    await this.commandProcessor.execute(command);
  }

  /**
   * Clean up relations when a file is deleted
   */
  async cleanupDeletedFileRelations(deletedFile: TFile): Promise<void> {
    this.getGraph().removeAllRelationsForFile(deletedFile);
  }

  /**
   * Add a relation manually
   */
  async addRelation(
    sourceFile: TFile,
    targetFile: TFile,
    type: RelationType,
    sourceLabel?: string,
    targetLabel?: string
  ): Promise<void> {
    const command = new AddRelationCommand(
      sourceFile,
      targetFile,
      type,
      sourceLabel,
      targetLabel
    );
    await this.commandProcessor.execute(command);
  }

  /**
   * Remove a relation manually
   */
  async removeRelation(
    sourceFile: TFile,
    targetFile: TFile,
    type: RelationType
  ): Promise<void> {
    const command = new RemoveRelationCommand(
      sourceFile,
      targetFile,
      type
    );
    await this.commandProcessor.execute(command);
  }

  /**
   * Subscribe to relation events
   */
  subscribeToEvents(handler: RelationEventHandler): void {
    this.eventBus.subscribeToAll(handler);
  }

  /**
   * Get graph statistics
   */
  getStats() {
    return this.getGraph().getStats();
  }

  /**
   * Find potential conflicts in relations
   */
  findConflicts() {
    return this.getGraph().findConflicts();
  }

  private findFileByName(name: string): TFile | null {
    const files = this.vault.getMarkdownFiles();
    return files.find(f => f.basename === name) || null;
  }

  private mapShardTypeToRelationType(type: 'related' | 'parent' | 'child'): RelationType {
    switch (type) {
      case 'related':
        return RelationType.Related;
      case 'parent':
        return RelationType.Parent;
      case 'child':
        return RelationType.Child;
    }
  }
} 