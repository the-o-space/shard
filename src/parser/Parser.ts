import type { TFile, MetadataCache } from 'obsidian';
import { Relation, Relations } from '../data/types/Relation';
import { language, RelationParseResult, RelationSymbol } from './Regex';
import * as P from 'parsimmon';
import { Shard, Shards } from '../data/types/Shard';
import { Hierarchies } from '../data/types/Hierarchy';
import { relationSymbolToType } from '../data/enums/RelationType';

enum LineType {
    Relation = 'relation',
    Hierarchy = 'hierarchy',
    Malformed = 'malformed'
}

export class Parser {
    private parser: P.Language;

    constructor(
        private readonly metadataCache: MetadataCache
    ) {
        this.parser = language;
    }

    /**
     * Parse all ```shards code blocks from the file content and return a `Shards` map.
     */
    parse(file: TFile, content: string): Shards {
        const shards: Shards = new Map();

        const blocks = this.getAllBlocks(content);

        const aggregatedRelations: Relations = [];
        const aggregatedHierarchies: Hierarchies = [];

        for (const block of blocks) {
            const shard: Shard = this.parseBlock(file, block);
            aggregatedRelations.push(...shard.relations);
            aggregatedHierarchies.push(...shard.hierarchies);
        }

        shards.set(file, {
            file,
            hierarchies: aggregatedHierarchies,
            relations: aggregatedRelations
        });

        return shards;
    }

    private getAllBlocks(content: string): string[] {
        const result = this.parser.allBlocks.parse(content);
        if (!result.status) return [];
        return result.value as string[];
    }

    private parseBlock(sourceFile: TFile, blockContent: string): Shard {
        const lines = blockContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));

        const relations: Relations = [];
        const hierarchies: Hierarchies = [];

        for (const line of lines) {
            const { type, value } = this.determineLineType(line);

            try {
                switch (type) {
                    case LineType.Relation: {
                        const relation = this.parseRelation(sourceFile, value as RelationParseResult);
                        relations.push(relation);
                        break;
                    }

                    case LineType.Hierarchy: {
                        const parsedHierarchies = this.parseHierarchy(value as string);
                        hierarchies.push(...parsedHierarchies);
                        break;
                    }

                    case LineType.Malformed: {
                        throw new Error(`Shards: Malformed line in ${sourceFile.path}: "${line}"`);
                    }
                }
            } catch (error) {
                // Log and continue parsing other lines
                console.error(`Shards: Error parsing line in ${sourceFile.path}: "${line}"`, error);
            }
        }

        return {
            file: sourceFile,
            hierarchies,
            relations
        };
    }

    private determineLineType(line: string): { type: LineType; value: RelationParseResult | string } {
        // First try relation; if it fails, try hierarchy; if both fail -> malformed
        const relationParse = this.parser.relationLine.parse(line);
        if (relationParse.status) {
            return { type: LineType.Relation, value: relationParse.value as RelationParseResult };
        }

        const hierarchyParse = this.parser.hierarchyLine.parse(line);
        if (hierarchyParse.status) {
            return { type: LineType.Hierarchy, value: hierarchyParse.value as string };
        }

        return { type: LineType.Malformed, value: line };
    }

    private resolveTarget(sourceFile: TFile, targetName: string): TFile {
        const normalized = targetName.startsWith('[[') && targetName.endsWith(']]')
            ? targetName.slice(2, -2)
            : targetName;

        const linkedFile = this.metadataCache.getFirstLinkpathDest(normalized, sourceFile.path);
        if (linkedFile) return linkedFile;

        throw new Error(`Shards: Cannot resolve target "${targetName}" from ${sourceFile.path}`);
    }

    private parseHierarchy(input: string): Hierarchies {
        const expandedPaths = this.expandBraces(input);

        const result: Hierarchies = [];
        for (const path of expandedPaths) {
            const components = path.split('/').filter(component => component.length > 0);
            if (components.length > 0) {
                result.push({
                    path: components,
                    label: ''
                });
            }
        }
        return result;
    }

    private expandBraces(str: string): string[] {
        const match = str.match(/\{([^}]+)\}/);
        if (!match) return [str];
        const prefix = str.slice(0, match.index);
        const suffix = str.slice((match.index ?? 0) + match[0].length);
        const options = match[1].split(',').map(option => option.trim());

        const expandedSuffixes = this.expandBraces(suffix);
        const result: string[] = [];
        options.forEach(option => {
            expandedSuffixes.forEach(suf => {
                result.push(prefix + option + suf);
            });
        });
        return result;
    }

    private parseRelation(sourceFile: TFile, parsed: RelationParseResult): Relation {
        const relationType = relationSymbolToType(parsed.symbol as RelationSymbol);
        const targetFile = this.resolveTarget(sourceFile, parsed.target);

        return {
            source: sourceFile,
            target: targetFile,
            type: relationType,
            label: parsed.label || '',
            infer: true
        };
    }
}