import { TFile, MetadataCache, Vault } from 'obsidian';
import { Parser } from './parser/Parser';
import { Graph } from './Graph';
import { Tree } from './Tree';
import { Shards } from './data/types/Shard';

/**
 * Central manager that coordinates parsing and data structure building
 */
export class Manager {
    private parser: Parser;
    private graph: Graph;
    private tree: Tree;
    private updatedListeners: Set<() => void> = new Set();
    
    constructor(
        private vault: Vault,
        private metadataCache: MetadataCache
    ) {
        this.parser = new Parser(metadataCache);
        this.graph = new Graph();
        this.tree = new Tree();

        console.log(this.vault);
    }

    /**
     * Parse all files and build data structures
     */
    async parseAllFiles(): Promise<void> {
        // Clear existing data
        this.graph.clear();
        this.tree.clear();
        
        // Get all markdown files
        const files = this.vault.getMarkdownFiles();

        console.log(files);
        
        for (const file of files) {
            await this.parseFile(file);
        }

        console.log(this.graph.getAllRelations());
        console.log(this.tree.getAllHierarchies());

        this.triggerUpdated();
    }

    /**
     * Parse a single file and update data structures
     */
    async parseFile(file: TFile): Promise<void> {
        try {
            const content = await this.vault.read(file);

            const shards = this.parser.parse(file, content);

            console.log(file.path, shards);
            
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
        // Remove old data
        this.removeFile(file);
        
        // Parse and add new data
        await this.parseFile(file);
        this.triggerUpdated();
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