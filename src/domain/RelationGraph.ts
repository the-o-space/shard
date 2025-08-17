import { TFile } from 'obsidian';
import { Relation, RelationIdentity, RelationType } from './Relation';

/**
 * Graph structure that maintains the current state of all relations
 */
export class RelationGraph {
  // Map from relation key to relation
  private relations: Map<string, Relation> = new Map();
  
  // Index by source file path
  private bySource: Map<string, Set<string>> = new Map();
  
  // Index by target file path  
  private byTarget: Map<string, Set<string>> = new Map();

  /**
   * Add or update a relation in the graph
   */
  addRelation(relation: Relation): void {
    const key = relation.identity.key;
    
    // Remove old indexes if updating
    const existing = this.relations.get(key);
    if (existing) {
      this.removeFromIndexes(existing);
    }
    
    // Add to main map
    this.relations.set(key, relation);
    
    // Update indexes
    this.addToIndexes(relation);
  }

  /**
   * Remove a relation from the graph
   */
  removeRelation(identity: RelationIdentity): void {
    const key = identity.key;
    const relation = this.relations.get(key);
    
    if (relation) {
      this.relations.delete(key);
      this.removeFromIndexes(relation);
    }
  }

  /**
   * Get a specific relation
   */
  getRelation(identity: RelationIdentity): Relation | undefined {
    return this.relations.get(identity.key);
  }

  /**
   * Get all relations for a source file
   */
  getRelationsBySource(file: TFile): Relation[] {
    const keys = this.bySource.get(file.path) || new Set();
    return Array.from(keys)
      .map(key => this.relations.get(key))
      .filter((r): r is Relation => r !== undefined);
  }

  /**
   * Get all relations targeting a file
   */
  getRelationsByTarget(file: TFile): Relation[] {
    const keys = this.byTarget.get(file.path) || new Set();
    return Array.from(keys)
      .map(key => this.relations.get(key))
      .filter((r): r is Relation => r !== undefined);
  }

  /**
   * Get all relations for a file (both source and target)
   */
  getAllRelationsForFile(file: TFile): {
    asSource: Relation[];
    asTarget: Relation[];
  } {
    return {
      asSource: this.getRelationsBySource(file),
      asTarget: this.getRelationsByTarget(file)
    };
  }

  /**
   * Remove all relations involving a file
   */
  removeAllRelationsForFile(file: TFile): Relation[] {
    const removed: Relation[] = [];
    
    // Remove as source
    const asSource = this.getRelationsBySource(file);
    for (const relation of asSource) {
      this.removeRelation(relation.identity);
      removed.push(relation);
    }
    
    // Remove as target
    const asTarget = this.getRelationsByTarget(file);
    for (const relation of asTarget) {
      this.removeRelation(relation.identity);
      removed.push(relation);
    }
    
    return removed;
  }

  /**
   * Get all relations in the graph
   */
  getAllRelations(): Relation[] {
    return Array.from(this.relations.values());
  }

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.relations.clear();
    this.bySource.clear();
    this.byTarget.clear();
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    totalRelations: number;
    fileCount: number;
    relationTypes: Record<RelationType, number>;
  } {
    const stats = {
      totalRelations: this.relations.size,
      fileCount: new Set([
        ...this.bySource.keys(),
        ...this.byTarget.keys()
      ]).size,
      relationTypes: {
        [RelationType.Related]: 0,
        [RelationType.Parent]: 0,
        [RelationType.Child]: 0
      }
    };

    for (const relation of this.relations.values()) {
      stats.relationTypes[relation.identity.type]++;
    }

    return stats;
  }

  /**
   * Find potential relation conflicts
   */
  findConflicts(): Array<{
    relation1: Relation;
    relation2: Relation;
    type: 'inverse-mismatch' | 'duplicate-type';
  }> {
    const conflicts: Array<{
      relation1: Relation;
      relation2: Relation;
      type: 'inverse-mismatch' | 'duplicate-type';
    }> = [];

    // Check for inverse mismatches
    for (const relation of this.relations.values()) {
      const inverseIdentity = relation.identity.getInverse();
      const inverseRelation = this.getRelation(inverseIdentity);
      
      if (inverseRelation) {
        // Check if labels match appropriately
        const expectedInverse = relation.getInverse();
        if (inverseRelation.sourceLabel?.value !== expectedInverse.sourceLabel?.value ||
            inverseRelation.targetLabel?.value !== expectedInverse.targetLabel?.value) {
          conflicts.push({
            relation1: relation,
            relation2: inverseRelation,
            type: 'inverse-mismatch'
          });
        }
      }
    }

    return conflicts;
  }

  private addToIndexes(relation: Relation): void {
    const key = relation.identity.key;
    const sourcePath = relation.identity.sourceFile.path;
    const targetPath = relation.identity.targetFile.path;
    
    // Add to source index
    if (!this.bySource.has(sourcePath)) {
      this.bySource.set(sourcePath, new Set());
    }
    this.bySource.get(sourcePath)!.add(key);
    
    // Add to target index
    if (!this.byTarget.has(targetPath)) {
      this.byTarget.set(targetPath, new Set());
    }
    this.byTarget.get(targetPath)!.add(key);
  }

  private removeFromIndexes(relation: Relation): void {
    const key = relation.identity.key;
    const sourcePath = relation.identity.sourceFile.path;
    const targetPath = relation.identity.targetFile.path;
    
    // Remove from source index
    const sourceSet = this.bySource.get(sourcePath);
    if (sourceSet) {
      sourceSet.delete(key);
      if (sourceSet.size === 0) {
        this.bySource.delete(sourcePath);
      }
    }
    
    // Remove from target index
    const targetSet = this.byTarget.get(targetPath);
    if (targetSet) {
      targetSet.delete(key);
      if (targetSet.size === 0) {
        this.byTarget.delete(targetPath);
      }
    }
  }
} 