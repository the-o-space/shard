import { TFile, MetadataCache, Vault, App } from 'obsidian';
import { Parser } from './services/parser/Parser';
import { Graph } from './Graph';
import { Tree } from './Tree';
import { Inferrer } from './services/inferrer/Inferrer';
import type { Relation } from './data/types/Relation';

/**
 * Central manager that coordinates parsing and data structure building
 */
export class Manager {
    private parser: Parser;
    private graph: Graph;
    private tree: Tree;
    private inferrer: Inferrer;
    private updatedListeners: Set<() => void> = new Set();
    private relationsByFile: Map<string, Relation[]> = new Map();
    
    constructor(
        private app: App,
        private vault: Vault,
        private metadataCache: MetadataCache
    ) {
        this.parser = new Parser(metadataCache);
        this.graph = new Graph();
        this.tree = new Tree();
        this.inferrer = new Inferrer(this.app, this.vault, this.parser);
    }

    /**
     * Parse all files and build data structures
     */
    async parseAllFiles(): Promise<void> {
        // Clear existing data
        this.graph.clear();
        this.tree.clear();
        this.relationsByFile.clear();
        this.triggerUpdated();
        
        // Get all markdown files
        const files = this.vault.getMarkdownFiles();
        
        for (const file of files) {
            await this.parseFile(file);
        }
    }

    /**
     * Parse a single file and update data structures
     */
    async parseFile(file: TFile): Promise<void> {
        try {
            const shards = this.parser.parse(file);
            const relations = shards.get(file)?.relations || [];
            this.relationsByFile.set(file.path, relations);

            // Process each shard
            for (const [shardFile, shard] of shards) {
                // Add relations to graph
                for (const relation of shard.relations) {
                    this.graph.addRelation(relation);
                }
                
                // Add hierarchies to tree
                if (shard.hierarchies.length > 0) {
                    this.tree.addHierarchies(shardFile, shard.hierarchies);
                }
            }

            this.triggerUpdated();
        } catch (error) {
            console.error(`Error parsing file ${file.path}:`, error);
        }
    }

    /**
     * Remove all data for a file
     */
    removeFile(file: TFile): void {
        this.graph.removeAllRelationsForFile(file);
        this.tree.removeHierarchiesForFile(file);
        this.relationsByFile.delete(file.path);
        this.triggerUpdated();
    }

    /**
     * Handle file rename
     */
    renameFile(oldFile: TFile, newFile: TFile): void {
        this.graph.changeFile(oldFile, newFile);
        this.tree.changeFile(oldFile, newFile);
        this.triggerUpdated();
    }

    /**
     * Reparse a file after modification
     */
    async reparseFile(file: TFile): Promise<void> {
        const oldRelations = this.relationsByFile.get(file.path) || [];

        // Remove old data
        this.removeFile(file);

        // Parse and add new data
        await this.parseFile(file);

        const newRelations = this.relationsByFile.get(file.path) || [];

        const added = newRelations.filter(r1 => !oldRelations.some(r2 => this.areRelationsEqual(r1, r2)));
        const removed = oldRelations.filter(r1 => !newRelations.some(r2 => this.areRelationsEqual(r1, r2)));

        if (added.length > 0 || removed.length > 0) {
            await this.inferrer.processChanges(file, added, removed);
        }
    }

    private areRelationsEqual(r1: Relation, r2: Relation): boolean {
        return r1.source.path === r2.source.path &&
            r1.target.path === r2.target.path &&
            r1.type === r2.type;
    }

    /**
     * Get the graph instance
     */
    getGraph(): Graph {
        return this.graph;
    }

    /**
     * Get the tree instance
     */
    getTree(): Tree {
        return this.tree;
    }

    /**
     * Get combined data for a file
     */
    getFileData(file: TFile) {
        return {
            relations: this.graph.getAllRelationsForFile(file),
            hierarchies: this.tree.getHierarchiesForFile(file)
        };
    }

    /**
     * Get statistics about parsed data
     */
    getStatistics() {
        return {
            totalRelations: this.graph.getAllRelations().length,
            totalFiles: this.tree.getAllFiles().length,
            filesWithRelations: new Set(
                this.graph.getAllRelations().flatMap(r => [r.source, r.target])
            ).size,
            filesWithHierarchies: this.tree.getAllFiles().length
        };
    }

    public onUpdated(callback: () => void): () => void {
        this.updatedListeners.add(callback);
        return () => this.updatedListeners.delete(callback);
    }

    private triggerUpdated(): void {
        for (const cb of this.updatedListeners) {
            try {
                cb();
            } catch (error) {
                console.error(error);
            }
        }
    }
}

// Simple update subscription API
export type ManagerUpdateUnsubscribe = () => void;