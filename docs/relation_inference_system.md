# Symmetrical Relation Inference System Design

## 1. System Specification

The core principle of this system is that relations between two files are treated as symmetrical pairs. There is no distinction between a "user-defined" relation and an "inferred" one. When a relation is created, modified, or deleted in one file, the corresponding inverse relation in the target file is automatically updated to maintain symmetry.

### 1.1. Core Behaviors

-   **Creation**: When a user adds a relation (e.g., `> "is parent of" Child`) in `Parent.md`, the system will automatically add the inverse relation (`< "is child of" Parent`) to `Child.md`. If `Child.md` does not have a `shards` block, one will be created.
-   **Deletion**: If a user deletes a relation in one file, the corresponding inverse relation in the other file is also deleted. For example, deleting `< "is child of" Parent` from `Child.md` will cause `> "is parent of" Child` to be removed from `Parent.md`.
-   **Modification**: Modifying a relation is treated as a `delete` followed by an `add`. For instance, changing `> "is parent of" Child` to `> "has priority over" Child` in `Parent.md` will trigger the deletion of the old inverse relation in `Child.md` and the creation of a new one.

### 1.2. Relation Symmetry Rules

| Relation in Source | Inverse Relation in Target |
| :--- | :--- |
| `>` (Parent) | `<` (Child) |
| `<` (Child) | `>` (Parent) |
| `=` (Related) | `=` (Related) |

Labels are not considered part of the relation's identity for symmetry purposes. A change in a label will not trigger an update in the inverse relation's label.

## 2. Architectural Design

To implement this system, we will introduce a new service and modify existing components to handle the new logic.

### 2.1. Components

-   **`Inferrer` Service (`src/services/Inferrer.ts`)**: A new, stateless service responsible for orchestrating relation inference. It will not hold any state of its own but will be called by the `Manager` to process changes.
-   **`Manager` (`src/Manager.ts`)**: The central coordinator. The `Manager` will be responsible for detecting changes in relations after a file is parsed. It will compare the "before" and "after" states of relations for a file and pass the detected changes (additions and deletions) to the `Inferrer`.
-   **`Parser` (`src/parser/Parser.ts`)**: The `Parser` will remain stateless and will not be directly involved in inference. Its role is to extract relations from file content.

### 2.2. Data Flow for a File Modification

1.  A user modifies a file.
2.  Obsidian's `vault.on('modify')` event is triggered in `Plugin.ts`.
3.  The `Manager.reparseFile()` method is called.
4.  Before reparsing, the `Manager` retrieves the current set of relations for the file (the "before" state).
5.  After reparsing, the `Manager` gets the new set of relations (the "after" state).
6.  The `Manager` computes the difference between the two states to get a list of `added` and `deleted` relations.
7.  These lists are passed to the `Inferrer.processChanges()` method.
8.  The `Inferrer` then reads the target files of the changed relations and applies the necessary modifications (adding or removing inverse relations).

## 3. Challenges and Solutions

The main challenge in a symmetrical system is preventing infinite update loops. For example, an update in `A.md` could trigger an update in `B.md`, which could then trigger an update back in `A.md`.

### 3.1. Infinite Loop Prevention

To solve this, we will implement a short-lived, in-memory cache to track the "last operation."

-   **"Last Operation" Cache**: This will be a simple cache in the `Inferrer` that stores a unique identifier for the last relation modification operation. An "operation" is defined as a user's action that results in a change to a relation.
-   **Operation Tracking**: When the `Inferrer` modifies a file, it will tag the change with the current operation's ID. When Obsidian's file modification event is triggered, the `Manager` will check if the change was caused by the `Inferrer` itself. If so, it will not trigger another round of inference.

### 3.2. Implementation of the Cache

The cache will store a key representing the inverse of the operation it just performed. For example, if it adds `< B` to file `A`, it will cache a key like `delete < B in A`. If it then immediately sees a request to delete `< B` in `A`, it will know this is a response to its own action and will ignore it.

This approach ensures that the system only reacts to user-initiated changes, breaking the cycle of programmatic updates.

This design provides a clear path forward for implementing a robust and predictable symmetrical relation inference system.
