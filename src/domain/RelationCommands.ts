import { TFile } from 'obsidian';
import { RelationType } from './Relation';

/**
 * Base class for all relation commands
 */
export abstract class RelationCommand {
  constructor(
    public readonly sourceFile: TFile,
    public readonly timestamp: Date = new Date()
  ) {}

  abstract validate(): string[];
}

/**
 * Command to add a new relation
 */
export class AddRelationCommand extends RelationCommand {
  constructor(
    sourceFile: TFile,
    public readonly targetFile: TFile,
    public readonly type: RelationType,
    public readonly sourceLabel?: string,
    public readonly targetLabel?: string
  ) {
    super(sourceFile);
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.sourceFile) {
      errors.push('Source file is required');
    }
    
    if (!this.targetFile) {
      errors.push('Target file is required');
    }
    
    if (this.sourceFile === this.targetFile) {
      errors.push('Cannot create relation to the same file');
    }
    
    if (!Object.values(RelationType).includes(this.type)) {
      errors.push('Invalid relation type');
    }
    
    return errors;
  }
}

/**
 * Command to update an existing relation
 */
export class UpdateRelationCommand extends RelationCommand {
  constructor(
    sourceFile: TFile,
    public readonly targetFile: TFile,
    public readonly type: RelationType,
    public readonly sourceLabel?: string,
    public readonly targetLabel?: string,
    public readonly updateBidirectional: boolean = true
  ) {
    super(sourceFile);
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.sourceFile || !this.targetFile) {
      errors.push('Both source and target files are required');
    }
    
    return errors;
  }
}

/**
 * Command to remove a relation
 */
export class RemoveRelationCommand extends RelationCommand {
  constructor(
    sourceFile: TFile,
    public readonly targetFile: TFile,
    public readonly type: RelationType,
    public readonly removeBidirectional: boolean = true
  ) {
    super(sourceFile);
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.sourceFile || !this.targetFile) {
      errors.push('Both source and target files are required');
    }
    
    return errors;
  }
}

/**
 * Command to sync relations after file parsing
 */
export class SyncRelationsCommand extends RelationCommand {
  constructor(
    sourceFile: TFile,
    public readonly parsedRelations: Array<{
      targetFile: TFile;
      type: RelationType;
      label?: string;
    }>
  ) {
    super(sourceFile);
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.sourceFile) {
      errors.push('Source file is required');
    }
    
    // Check for duplicate relations
    const seen = new Set<string>();
    for (const rel of this.parsedRelations) {
      const key = `${rel.targetFile.path}|${rel.type}`;
      if (seen.has(key)) {
        errors.push(`Duplicate relation found: ${rel.targetFile.basename} (${rel.type})`);
      }
      seen.add(key);
    }
    
    return errors;
  }
} 