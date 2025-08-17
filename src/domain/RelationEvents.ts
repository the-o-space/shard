import { TFile } from 'obsidian';
import { Relation, RelationType } from './Relation';

/**
 * Base class for all relation events
 */
export abstract class RelationEvent {
  constructor(
    public readonly timestamp: Date = new Date(),
    public readonly id: string = crypto.randomUUID()
  ) {}

  abstract get eventType(): string;
}

/**
 * Event fired when a relation is added
 */
export class RelationAddedEvent extends RelationEvent {
  constructor(
    public readonly relation: Relation,
    public readonly isInverse: boolean = false
  ) {
    super();
  }

  get eventType(): string {
    return 'RelationAdded';
  }
}

/**
 * Event fired when a relation is updated
 */
export class RelationUpdatedEvent extends RelationEvent {
  constructor(
    public readonly oldRelation: Relation,
    public readonly newRelation: Relation,
    public readonly isInverse: boolean = false
  ) {
    super();
  }

  get eventType(): string {
    return 'RelationUpdated';
  }
}

/**
 * Event fired when a relation is removed
 */
export class RelationRemovedEvent extends RelationEvent {
  constructor(
    public readonly relation: Relation,
    public readonly isInverse: boolean = false
  ) {
    super();
  }

  get eventType(): string {
    return 'RelationRemoved';
  }
}

/**
 * Event fired when file relations are synced
 */
export class RelationsSyncedEvent extends RelationEvent {
  constructor(
    public readonly sourceFile: TFile,
    public readonly addedRelations: Relation[],
    public readonly updatedRelations: Array<{ old: Relation; new: Relation }>,
    public readonly removedRelations: Relation[]
  ) {
    super();
  }

  get eventType(): string {
    return 'RelationsSynced';
  }
}

/**
 * Event fired when a file is deleted
 */
export class FileDeletedEvent extends RelationEvent {
  constructor(
    public readonly file: TFile,
    public readonly affectedRelations: Relation[]
  ) {
    super();
  }

  get eventType(): string {
    return 'FileDeleted';
  }
}

/**
 * Interface for event handlers
 */
export interface RelationEventHandler {
  handle(event: RelationEvent): Promise<void>;
}

/**
 * Event bus for publishing and subscribing to relation events
 */
export class RelationEventBus {
  private handlers: Map<string, RelationEventHandler[]> = new Map();
  private allHandlers: RelationEventHandler[] = [];

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: string, handler: RelationEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(handler: RelationEventHandler): void {
    this.allHandlers.push(handler);
  }

  /**
   * Publish an event
   */
  async publish(event: RelationEvent): Promise<void> {
    // Notify specific handlers
    const specificHandlers = this.handlers.get(event.eventType) || [];
    for (const handler of specificHandlers) {
      await handler.handle(event);
    }

    // Notify all-event handlers
    for (const handler of this.allHandlers) {
      await handler.handle(event);
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.allHandlers = [];
  }
} 