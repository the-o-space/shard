import type { TFile } from 'obsidian';
import { Hierarchies } from './data/types/Hierarchy';

/**
 * Tree structure for managing hierarchical paths
 */
export class Tree {
    private hierarchies: Map<TFile, Hierarchies> = new Map();
    
    constructor() {}

    /**
     * Add hierarchies for a file
     */
    addHierarchies(file: TFile, hierarchies: Hierarchies): void {
        if (hierarchies.length === 0) return;
        
        const existing = this.hierarchies.get(file) || [];
        this.hierarchies.set(file, [...existing, ...hierarchies]);
    }

    /**
     * Get all hierarchies for a file
     */
    getHierarchiesForFile(file: TFile): Hierarchies {
        return this.hierarchies.get(file) || [];
    }

    /**
     * Remove all hierarchies for a file
     */
    removeHierarchiesForFile(file: TFile): void {
        this.hierarchies.delete(file);
    }

    /**
     * Rename file in all hierarchies
     */
    changeFile(oldFile: TFile, newFile: TFile): void {
        const hierarchies = this.hierarchies.get(oldFile);
        if (hierarchies) {
            this.hierarchies.delete(oldFile);
            this.hierarchies.set(newFile, hierarchies);
        }
    }

    /**
     * Clear all hierarchies
     */
    clear(): void {
        this.hierarchies.clear();
    }

    /**
     * Get all files with hierarchies
     */
    getAllFiles(): TFile[] {
        return Array.from(this.hierarchies.keys());
    }

    /**
     * Get all hierarchies as a flat structure
     */
    getAllHierarchies(): Array<{ file: TFile; paths: Hierarchies }> {
        return Array.from(this.hierarchies.entries()).map(([file, paths]) => ({
            file,
            paths
        }));
    }

    /**
     * Get hierarchies containing a specific path component
     */
    findHierarchiesWithComponent(component: string): Array<{ file: TFile; paths: string[] }> {
        const results: Array<{ file: TFile; paths: string[] }> = [];
        
        for (const [file, hierarchies] of this.hierarchies) {
            const matchingPaths = hierarchies.filter(hierarchy => 
                hierarchy.path.some(part => part.includes(component))
            ).map(hierarchy => hierarchy.path.join('/'));
            
            if (matchingPaths.length > 0) {
                results.push({ file, paths: matchingPaths });
            }
        }
        
        return results;
    }

    /**
     * Build a tree representation of all hierarchies
     */
    buildTreeRepresentation(): TreeNode {
        const root: TreeNode = { name: 'root', children: new Map() };
        
        for (const [file, hierarchies] of this.hierarchies) {
            for (const hierarchy of hierarchies) {
                this.addPathToTree(root, hierarchy.path, file);
            }
        }
        
        return root;
    }

    private addPathToTree(node: TreeNode, path: string[], file: TFile): void {
        if (path.length === 0) {
            if (!node.files) node.files = [];
            node.files.push(file);
            return;
        }
        
        const [head, ...tail] = path;
        if (!node.children.has(head)) {
            node.children.set(head, { name: head, children: new Map() });
        }
        
        this.addPathToTree(node.children.get(head)!, tail, file);
    }
}

export interface TreeNode {
    name: string;
    children: Map<string, TreeNode>;
    files?: TFile[];
}