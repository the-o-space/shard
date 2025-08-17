# Relations System Architecture

## Overview

The relations system has been redesigned using Domain-Driven Design (DDD) and Command Query Responsibility Segregation (CQRS) patterns to address critical issues with bidirectional relation management and label conflicts.

## Problems Solved

1. **Label Overwrites**: When adding a labeled relation like `> "Design Doc" ProjectX`, the system now preserves existing labels in the target file instead of overwriting them.

2. **Bidirectional Sync Issues**: Parent-child relations are now properly synchronized. When you define a parent relation, the child relation is automatically created in the parent file.

3. **Conflict Resolution**: The system now has configurable strategies for resolving conflicts between labels (newest vs prefer-non-empty).

4. **Data Consistency**: Using an event-driven architecture ensures all changes are tracked and can be rolled back if needed.

## Key Components

### Domain Model (`/domain`)

- **Relation**: Core entity representing a relation between two files
  - Has identity (source, target, type)
  - Can have labels on both ends
  - Immutable - changes create new instances
  - Can generate its inverse relation

- **RelationIdentity**: Value object uniquely identifying a relation
  - Ensures no duplicate relations
  - Can generate inverse identity

- **RelationLabel**: Value object for relation labels
  - Tracks modification time for conflict resolution
  - Can merge with other labels using strategies

- **RelationGraph**: In-memory graph of all relations
  - Efficient lookups by source/target
  - Conflict detection
  - Maintains consistency

### Command Layer (`/domain/RelationCommands.ts`)

Commands represent user intentions:
- **AddRelationCommand**: Add a new relation
- **UpdateRelationCommand**: Update existing relation
- **RemoveRelationCommand**: Remove a relation
- **SyncRelationsCommand**: Sync relations after file parsing

### Event System (`/domain/RelationEvents.ts`)

Events record what happened:
- **RelationAddedEvent**: A relation was added
- **RelationUpdatedEvent**: A relation was updated
- **RelationRemovedEvent**: A relation was removed
- **RelationsSyncedEvent**: File relations were synchronized

### Command Processor (`/services/RelationCommandProcessor.ts`)

The brain of the system:
1. Validates commands
2. Updates the graph
3. Handles bidirectional sync
4. Resolves conflicts
5. Updates files
6. Publishes events

## How It Works

### Adding a Relation with Label

```typescript
// User adds: > "Architecture" SystemDesign
const command = new AddRelationCommand(
  currentFile, 
  systemDesignFile,
  RelationType.Parent,
  "Architecture", // source label
  undefined       // target label
);

// Processor:
1. Creates relation with source label "Architecture"
2. Creates inverse relation (child) in SystemDesign file
3. Checks if SystemDesign already has a label for this relation
4. Merges labels using conflict strategy (prefer-non-empty)
5. Updates both files with proper labels
```

### Conflict Resolution

When two relations have different labels:

```typescript
// FileA has: > "Design" FileB
// FileB has: < "Implementation" FileA

// With 'prefer-non-empty' strategy:
// Result: Both files keep their labels
// FileA: > "Design" FileB
// FileB: < "Implementation" FileA
```

### Bidirectional Sync

Every relation automatically maintains its inverse:

```typescript
// Adding parent relation
FileA: > FileB

// Automatically creates child relation
FileB: < FileA

// With labels
FileA: > "Parent Label" FileB
FileB: < FileA  // Gets "Parent Label" on the FileA side
```

## Benefits

1. **Data Integrity**: Relations are always consistent
2. **Audit Trail**: Event history tracks all changes
3. **Testability**: Each component can be tested in isolation
4. **Extensibility**: Easy to add new relation types or strategies
5. **Performance**: In-memory graph provides fast lookups
6. **Reliability**: Commands can be validated before execution

## Configuration

```typescript
const config = {
  conflictStrategy: 'prefer-non-empty', // or 'newest'
  enableBidirectionalSync: true,
  showNotifications: true
};
```

## Future Enhancements

1. **Undo/Redo**: Event sourcing enables time travel
2. **Batch Operations**: Process multiple relations atomically
3. **Relation Templates**: Predefined relation patterns
4. **Validation Rules**: Custom business rules for relations
5. **Migration Tools**: Update existing vaults to new format 