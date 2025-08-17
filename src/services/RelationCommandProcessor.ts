import { Notice, TFile, Vault } from 'obsidian';
import { 
  Relation, 
  RelationIdentity, 
  RelationLabel, 
  RelationType 
} from '../domain/Relation';
import { RelationGraph } from '../domain/RelationGraph';
import { 
  RelationCommand, 
  AddRelationCommand, 
  UpdateRelationCommand, 
  RemoveRelationCommand, 
  SyncRelationsCommand 
} from '../domain/RelationCommands';
import { 
  RelationEventBus, 
  RelationAddedEvent, 
  RelationUpdatedEvent, 
  RelationRemovedEvent, 
  RelationsSyncedEvent 
} from '../domain/RelationEvents';
import { ShardParser } from '../model/ShardParser';

/**
 * Configuration for the command processor
 */
export interface CommandProcessorConfig {
  conflictStrategy: 'newest' | 'prefer-non-empty';
  enableBidirectionalSync: boolean;
  showNotifications: boolean;
}

/**
 * Processes relation commands and maintains the relation graph
 */
export class RelationCommandProcessor {
  private graph: RelationGraph;
  private eventBus: RelationEventBus;
  private vault: Vault;
  private parser: ShardParser;
  private config: CommandProcessorConfig;

  constructor(
    vault: Vault,
    eventBus: RelationEventBus,
    config: Partial<CommandProcessorConfig> = {}
  ) {
    this.graph = new RelationGraph();
    this.eventBus = eventBus;
    this.vault = vault;
    this.parser = new ShardParser();
    this.config = {
      conflictStrategy: 'prefer-non-empty',
      enableBidirectionalSync: true,
      showNotifications: true,
      ...config
    };
  }

  /**
   * Execute a relation command
   */
  async execute(command: RelationCommand): Promise<void> {
    // Validate command
    const errors = command.validate();
    if (errors.length > 0) {
      const message = `Invalid command: ${errors.join(', ')}`;
      if (this.config.showNotifications) {
        new Notice(message);
      }
      throw new Error(message);
    }

    // Process based on command type
    if (command instanceof AddRelationCommand) {
      await this.processAddRelation(command);
    } else if (command instanceof UpdateRelationCommand) {
      await this.processUpdateRelation(command);
    } else if (command instanceof RemoveRelationCommand) {
      await this.processRemoveRelation(command);
    } else if (command instanceof SyncRelationsCommand) {
      await this.processSyncRelations(command);
    }
  }

  /**
   * Get the current relation graph
   */
  getGraph(): RelationGraph {
    return this.graph;
  }

  /**
   * Rebuild the entire graph from vault files
   */
  async rebuildGraph(): Promise<void> {
    this.graph.clear();
    const files = this.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await this.vault.read(file);
      const shardLines = this.parser.parseShardsFromContent(content);
      
      // Parse relations from shards
      for (const shardLine of shardLines) {
        const shard = this.parser.parseShard(shardLine);
        
        if (shard.type === 'related' || shard.type === 'parent' || shard.type === 'child') {
          const targetFile = this.findFileByName(shard.cleanName || shard.value);
          if (!targetFile) continue;
          
          const type = this.mapToRelationType(shard.type);
          const identity = new RelationIdentity(file, targetFile, type);
          const relation = new Relation(
            identity,
            shard.label ? new RelationLabel(shard.label) : undefined,
            undefined
          );
          this.graph.addRelation(relation);
        }
      }
    }

    // Check for conflicts and resolve them
    const conflicts = this.graph.findConflicts();
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict.relation1, conflict.relation2);
    }
  }

  private async processAddRelation(command: AddRelationCommand): Promise<void> {
    const identity = new RelationIdentity(
      command.sourceFile,
      command.targetFile,
      command.type
    );

    // Check if relation already exists
    const existing = this.graph.getRelation(identity);
    if (existing) {
      // Update instead
      const updateCommand = new UpdateRelationCommand(
        command.sourceFile,
        command.targetFile,
        command.type,
        command.sourceLabel,
        command.targetLabel
      );
      await this.processUpdateRelation(updateCommand);
      return;
    }

    // Create new relation
    const relation = new Relation(
      identity,
      command.sourceLabel ? new RelationLabel(command.sourceLabel) : undefined,
      command.targetLabel ? new RelationLabel(command.targetLabel) : undefined
    );

    // Add to graph
    this.graph.addRelation(relation);

    // Update file
    await this.updateFileForRelation(relation);

    // Handle bidirectional sync
    if (this.config.enableBidirectionalSync) {
      const inverse = relation.getInverse();
      
      // Check for existing inverse relation
      const existingInverse = this.graph.getRelation(inverse.identity);
      if (existingInverse) {
        // Merge labels if needed
        const merged = existingInverse.merge(inverse, this.config.conflictStrategy);
        this.graph.addRelation(merged);
        await this.updateFileForRelation(merged);
      } else {
        this.graph.addRelation(inverse);
        await this.updateFileForRelation(inverse);
      }
    }

    // Emit event
    await this.eventBus.publish(new RelationAddedEvent(relation));
  }

  private async processUpdateRelation(command: UpdateRelationCommand): Promise<void> {
    const identity = new RelationIdentity(
      command.sourceFile,
      command.targetFile,
      command.type
    );

    const existing = this.graph.getRelation(identity);
    if (!existing) {
      // Add instead
      const addCommand = new AddRelationCommand(
        command.sourceFile,
        command.targetFile,
        command.type,
        command.sourceLabel,
        command.targetLabel
      );
      await this.processAddRelation(addCommand);
      return;
    }

    // Create updated relation
    const updated = existing.withLabels(
      command.sourceLabel ? new RelationLabel(command.sourceLabel) : existing.sourceLabel,
      command.targetLabel ? new RelationLabel(command.targetLabel) : existing.targetLabel
    );

    // Update graph
    this.graph.addRelation(updated);

    // Update file
    await this.updateFileForRelation(updated);

    // Handle bidirectional sync
    if (command.updateBidirectional && this.config.enableBidirectionalSync) {
      const inverseUpdated = updated.getInverse();
      const existingInverse = this.graph.getRelation(inverseUpdated.identity);
      
      if (existingInverse) {
        const merged = existingInverse.merge(inverseUpdated, this.config.conflictStrategy);
        this.graph.addRelation(merged);
        await this.updateFileForRelation(merged);
      } else {
        this.graph.addRelation(inverseUpdated);
        await this.updateFileForRelation(inverseUpdated);
      }
    }

    // Emit event
    await this.eventBus.publish(new RelationUpdatedEvent(existing, updated));
  }

  private async processRemoveRelation(command: RemoveRelationCommand): Promise<void> {
    const identity = new RelationIdentity(
      command.sourceFile,
      command.targetFile,
      command.type
    );

    const existing = this.graph.getRelation(identity);
    if (!existing) {
      return; // Nothing to remove
    }

    // Remove from graph
    this.graph.removeRelation(identity);

    // Remove from file
    await this.removeRelationFromFile(existing);

    // Handle bidirectional sync
    if (command.removeBidirectional && this.config.enableBidirectionalSync) {
      const inverseIdentity = identity.getInverse();
      const inverse = this.graph.getRelation(inverseIdentity);
      
      if (inverse) {
        this.graph.removeRelation(inverseIdentity);
        await this.removeRelationFromFile(inverse);
      }
    }

    // Emit event
    await this.eventBus.publish(new RelationRemovedEvent(existing));
  }

  private async processSyncRelations(command: SyncRelationsCommand): Promise<void> {
    const file = command.sourceFile;
    const currentRelations = this.graph.getRelationsBySource(file);
    
    // Build map of desired relations
    const desiredMap = new Map<string, typeof command.parsedRelations[0]>();
    for (const parsed of command.parsedRelations) {
      const identity = new RelationIdentity(file, parsed.targetFile, parsed.type);
      desiredMap.set(identity.key, parsed);
    }

    // Find relations to add, update, or remove
    const toAdd: Relation[] = [];
    const toUpdate: Array<{ old: Relation; new: Relation }> = [];
    const toRemove: Relation[] = [];

    // Check existing relations
    for (const current of currentRelations) {
      const desired = desiredMap.get(current.identity.key);
      if (!desired) {
        toRemove.push(current);
      } else {
        // Check if labels need updating
        const newLabel = desired.label ? new RelationLabel(desired.label) : undefined;
        if (current.sourceLabel?.value !== newLabel?.value) {
          const updated = current.withLabels(newLabel, current.targetLabel);
          toUpdate.push({ old: current, new: updated });
        }
        desiredMap.delete(current.identity.key);
      }
    }

    // Remaining items in desiredMap are new relations
    for (const [key, parsed] of desiredMap) {
      const identity = new RelationIdentity(file, parsed.targetFile, parsed.type);
      const relation = new Relation(
        identity,
        parsed.label ? new RelationLabel(parsed.label) : undefined
      );
      toAdd.push(relation);
    }

    // Apply changes
    for (const relation of toRemove) {
      this.graph.removeRelation(relation.identity);
      if (this.config.enableBidirectionalSync) {
        await this.removeRelationFromFile(relation.getInverse());
        this.graph.removeRelation(relation.identity.getInverse());
      }
    }

    for (const { old, new: updated } of toUpdate) {
      this.graph.addRelation(updated);
      if (this.config.enableBidirectionalSync) {
        const inverseUpdated = updated.getInverse();
        const existingInverse = this.graph.getRelation(inverseUpdated.identity);
        if (existingInverse) {
          const merged = existingInverse.merge(inverseUpdated, this.config.conflictStrategy);
          this.graph.addRelation(merged);
          await this.updateFileForRelation(merged);
        }
      }
    }

    for (const relation of toAdd) {
      this.graph.addRelation(relation);
      if (this.config.enableBidirectionalSync) {
        const inverse = relation.getInverse();
        this.graph.addRelation(inverse);
        await this.updateFileForRelation(inverse);
      }
    }

    // Emit event
    await this.eventBus.publish(new RelationsSyncedEvent(
      file,
      toAdd,
      toUpdate,
      toRemove
    ));
  }

  private async updateFileForRelation(relation: Relation): Promise<void> {
    const file = relation.identity.sourceFile;
    const content = await this.vault.read(file);
    const shardLine = this.createShardLine(relation);
    
    // Check if shard already exists using component-based matching
    const shardLines = this.parser.parseShardsFromContent(content);
    const newShard = this.parser.parseShard(shardLine);
    
    const exists = shardLines.some(line => {
      const parsed = this.parser.parseShard(line);
      return parsed.type === newShard.type &&
             (parsed.cleanName || parsed.value) === (newShard.cleanName || newShard.value) &&
             parsed.label === newShard.label;
    });
    
    if (!exists) {
      await this.addShardToFile(file, shardLine);
    }
  }

  private async removeRelationFromFile(relation: Relation): Promise<void> {
    const file = relation.identity.sourceFile;
    const shardLine = this.createShardLine(relation);
    await this.removeShardFromFile(file, shardLine);
  }

  private async addShardToFile(file: TFile, shardLine: string): Promise<void> {
    const content = await this.vault.read(file);
    const lines = content.split('\n');
    const codeBlockRegex = /^```shards$/;
    const codeBlockEndRegex = /^```$/;
    
    let inBlock = false;
    let blockStart = -1;
    let blockEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (!inBlock && codeBlockRegex.test(lines[i])) {
        inBlock = true;
        blockStart = i;
      } else if (inBlock && codeBlockEndRegex.test(lines[i])) {
        blockEnd = i;
        break;
      }
    }
    
    if (blockStart !== -1 && blockEnd !== -1) {
      lines.splice(blockEnd, 0, shardLine);
    } else {
      // Create new shards block at the end
      if (content && !content.endsWith('\n')) {
        lines.push('');
      }
      lines.push('```shards', shardLine, '```');
    }
    
    await this.vault.modify(file, lines.join('\n'));
  }

  private async removeShardFromFile(file: TFile, shardLine: string): Promise<void> {
    const content = await this.vault.read(file);
    const lines = content.split('\n');
    
    // Parse the shard line to get its components
    const shardToRemove = this.parser.parseShard(shardLine);
    
    // Find and remove the shard line by comparing parsed components
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i].trim();
      if (!currentLine) continue;
      
      const currentShard = this.parser.parseShard(currentLine);
      
      // Match by type, target name, and label (ignoring spacing differences)
      if (currentShard.type === shardToRemove.type &&
          (currentShard.cleanName || currentShard.value) === (shardToRemove.cleanName || shardToRemove.value) &&
          currentShard.label === shardToRemove.label) {
        lines.splice(i, 1);
        break;
      }
    }
    
    await this.vault.modify(file, lines.join('\n'));
  }

  private createShardLine(relation: Relation): string {
    const prefix = this.getShardPrefix(relation.identity.type);
    const targetName = relation.identity.targetFile.basename;
    
    if (relation.sourceLabel && !relation.sourceLabel.isEmpty) {
      return `${prefix} "${relation.sourceLabel.value}" ${targetName}`;
    } else {
      return `${prefix} ${targetName}`;
    }
  }

  private getShardPrefix(type: RelationType): string {
    switch (type) {
      case RelationType.Related:
        return '=';
      case RelationType.Parent:
        return '<';
      case RelationType.Child:
        return '>';
    }
  }

  private mapToRelationType(type: 'related' | 'parent' | 'child'): RelationType {
    switch (type) {
      case 'related':
        return RelationType.Related;
      case 'parent':
        return RelationType.Parent;
      case 'child':
        return RelationType.Child;
    }
  }

  private findFileByName(name: string): TFile | null {
    const files = this.vault.getMarkdownFiles();
    return files.find(f => f.basename === name) || null;
  }

  private async resolveConflict(relation1: Relation, relation2: Relation): Promise<void> {
    // For now, just merge them
    const merged = relation1.merge(relation2, this.config.conflictStrategy);
    this.graph.addRelation(merged);
    await this.updateFileForRelation(merged);
  }
} 