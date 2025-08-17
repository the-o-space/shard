import { Relation } from './data/types/Relation';
import { TFile } from 'obsidian';

class Key {
    public readonly key: string;

    constructor(
        public readonly source: string,
        public readonly target: string,
        public readonly type: string,
        public readonly label: string
    ) {
        this.key = `${source}|${target}|${type}|${label}`;
    }

    [Symbol.toPrimitive](): string {
        return this.key;
    }
}

/**
 * Main graph structure maintaining all relations as single source of truth
 */
export class Graph {
    private relations: Map<Key, Relation> = new Map();
    private outgoing: Map<TFile, Set<Key>> = new Map();
    private incoming: Map<TFile, Set<Key>> = new Map();
    
    constructor() {}

    /**
     * Compute unique key for a relation
     */
    computeKey(rel: Relation): Key {
        return new Key(rel.source.path, rel.target.path, rel.type, rel.label);
    }

    /**
     * Add a relation to the graph
     */
    addRelation(rel: Relation): void {
        const key = this.computeKey(rel);
        if (this.relations.has(key)) {
            console.warn(`Relation already exists: ${key.key}`);
            return;
        }
        
        this.relations.set(key, rel);

        this.addToMap(this.outgoing, rel.source, key);
        this.addToMap(this.incoming, rel.target, key);
    }

    /**
     * Remove a relation from the graph
     */
    removeRelation(key: Key): void {
        const rel = this.relations.get(key);
        if (!rel) {
            console.warn(`Relation not found: ${key}`);
            return;
        }

        this.relations.delete(key);
        this.removeFromMap(this.outgoing, rel.source, key);
        this.removeFromMap(this.incoming, rel.target, key);
    }

    /**
     * Get all relations for a file
     */
    getAllRelationsForFile(file: TFile): Relation[] {
        const outgoingKeys = this.outgoing.get(file) || new Set<Key>();
        const incomingKeys = this.incoming.get(file) || new Set<Key>();
        const allKeys = new Set([...outgoingKeys, ...incomingKeys]);
        return Array.from(allKeys)
            .map(key => this.relations.get(key))
            .filter((rel): rel is Relation => rel !== undefined);
    }

    /**
     * Clear all relations
     */
    clear(): void {
        this.relations.clear();
        this.outgoing.clear();
        this.incoming.clear();
    }

    /**
     * Get all relations
     */
    getAllRelations(): Relation[] {
        return Array.from(this.relations.values());
    }

    /**
     * Remove all relations for a file
     */
    removeAllRelationsForFile(file: TFile): void {
        // Remove outgoing
        const outgoingKeys = Array.from(this.outgoing.get(file) || []);
        for (const key of outgoingKeys) {
            this.removeRelation(key);
        }

        // Remove incoming
        const incomingRels = this.getAllRelationsForFile(file);
        for (const rel of incomingRels) {
            this.removeRelation(this.computeKey(rel));
        }
    }

    /**
     * Rename file in all relations
     */
    changeFile(oldFile: TFile, newFile: TFile): void {
        const affectedRelations: Relation[] = [];
        
        // Collect all affected relations
        for (const rel of this.relations.values()) {
            if (rel.source === oldFile || rel.target === oldFile) {
                affectedRelations.push(rel);
            }
        }

        // Remove old relations
        for (const rel of affectedRelations) {
            this.removeRelation(this.computeKey(rel));
        }

        // Add updated relations
        for (const rel of affectedRelations) {
            const updated = {
                ...rel,
                source: rel.source === oldFile ? newFile : rel.source,
                target: rel.target === oldFile ? newFile : rel.target,
            };
            this.addRelation(updated);
        }
    }

    private addToMap(map: Map<TFile, Set<Key>>, key: TFile, value: Key): void {
        if (!map.has(key)) {
            map.set(key, new Set());
        }
        map.get(key)!.add(value);
    }

    private removeFromMap(map: Map<TFile, Set<Key>>, key: TFile, value: Key): void {
        const set = map.get(key);
        if (set) {
            set.delete(value);
            if (set.size === 0) {
                map.delete(key);
            }
        }
    }
} 