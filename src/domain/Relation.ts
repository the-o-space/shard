import { TFile } from 'obsidian';

/**
 * Represents the type of relation between files
 */
export enum RelationType {
  Related = 'related',
  Parent = 'parent',
  Child = 'child'
}

/**
 * Represents a unique identity for a relation
 */
export class RelationIdentity {
  constructor(
    public readonly sourceFile: TFile,
    public readonly targetFile: TFile,
    public readonly type: RelationType
  ) {}

  /**
   * Get a unique key for this relation
   */
  get key(): string {
    return `${this.sourceFile.path}|${this.targetFile.path}|${this.type}`;
  }

  /**
   * Check if this identity matches another
   */
  equals(other: RelationIdentity): boolean {
    return this.key === other.key;
  }

  /**
   * Get the inverse relation identity
   */
  getInverse(): RelationIdentity {
    const inverseType = this.getInverseType();
    return new RelationIdentity(this.targetFile, this.sourceFile, inverseType);
  }

  private getInverseType(): RelationType {
    switch (this.type) {
      case RelationType.Related:
        return RelationType.Related;
      case RelationType.Parent:
        return RelationType.Child;
      case RelationType.Child:
        return RelationType.Parent;
    }
  }
}

/**
 * Represents a label for a relation
 */
export class RelationLabel {
  constructor(
    public readonly value: string | undefined,
    public readonly lastModified: Date = new Date()
  ) {}

  /**
   * Check if this label is empty
   */
  get isEmpty(): boolean {
    return !this.value || this.value.trim() === '';
  }

  /**
   * Merge with another label based on conflict resolution rules
   */
  merge(other: RelationLabel, conflictStrategy: 'newest' | 'prefer-non-empty' = 'newest'): RelationLabel {
    if (conflictStrategy === 'newest') {
      return this.lastModified > other.lastModified ? this : other;
    } else {
      // Prefer non-empty labels
      if (this.isEmpty && !other.isEmpty) return other;
      if (!this.isEmpty && other.isEmpty) return this;
      // Both non-empty or both empty, use newest
      return this.lastModified > other.lastModified ? this : other;
    }
  }
}

/**
 * Represents a relation between two files
 */
export class Relation {
  constructor(
    public readonly identity: RelationIdentity,
    public readonly sourceLabel?: RelationLabel,
    public readonly targetLabel?: RelationLabel,
    public readonly createdAt: Date = new Date(),
    public readonly modifiedAt: Date = new Date()
  ) {}

  /**
   * Create an updated relation with new labels
   */
  withLabels(sourceLabel?: RelationLabel, targetLabel?: RelationLabel): Relation {
    return new Relation(
      this.identity,
      sourceLabel,
      targetLabel,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Get the inverse relation
   */
  getInverse(): Relation {
    return new Relation(
      this.identity.getInverse(),
      this.targetLabel, // Target label becomes source label
      this.sourceLabel, // Source label becomes target label
      this.createdAt,
      this.modifiedAt
    );
  }

  /**
   * Merge with another relation
   */
  merge(other: Relation, conflictStrategy: 'newest' | 'prefer-non-empty' = 'newest'): Relation {
    if (!this.identity.equals(other.identity)) {
      throw new Error('Cannot merge relations with different identities');
    }

    const mergedSourceLabel = this.sourceLabel && other.sourceLabel
      ? this.sourceLabel.merge(other.sourceLabel, conflictStrategy)
      : this.sourceLabel || other.sourceLabel;

    const mergedTargetLabel = this.targetLabel && other.targetLabel
      ? this.targetLabel.merge(other.targetLabel, conflictStrategy)
      : this.targetLabel || other.targetLabel;

    return new Relation(
      this.identity,
      mergedSourceLabel,
      mergedTargetLabel,
      this.createdAt < other.createdAt ? this.createdAt : other.createdAt,
      new Date()
    );
  }
} 