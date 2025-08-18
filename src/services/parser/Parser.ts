import type { TFile, MetadataCache } from 'obsidian';
import { Relation, Relations } from '../../data/types/Relation';
import { Shards } from '../../data/types/Shard';
import { Hierarchies } from '../../data/types/Hierarchy';
import { RelationType } from '../../data/enums/RelationType';

export class Parser {
    constructor(private readonly metadataCache: MetadataCache) {}

    /**
     * Parse frontmatter from the file content and return a `Shards` map.
     *
     * @param file - The file to parse.
     * @returns A `Shards` map.
     */
    parse(file: TFile): Shards {
        const shards: Shards = new Map();
        const frontmatter = this.metadataCache.getCache(file.path)?.frontmatter;

        if (!frontmatter) {
            return shards;
        }

        const hierarchies = this.parseHierarchies(frontmatter.hierarchy);
        const relations = this.parseRelations(file, frontmatter);

        shards.set(file, {
            file,
            hierarchies,
            relations
        });

        return shards;
    }

    private parseHierarchies(hierarchyData: unknown): Hierarchies {
        if (!hierarchyData) {
            return [];
        }

        const hierarchies: Hierarchies = [];
        const entries = Array.isArray(hierarchyData) ? hierarchyData : [hierarchyData];

        for (const entry of entries) {
            if (typeof entry === 'string') {
                const expandedPaths = this.expandBraces(entry);
                for (const path of expandedPaths) {
                    const components = path.split('/').filter(component => component.length > 0);
                    if (components.length > 0) {
                        hierarchies.push({
                            path: components,
                            label: ''
                        });
                    }
                }
            }
        }

        return hierarchies;
    }

    private parseRelations(sourceFile: TFile, frontmatter: Record<string, unknown>): Relations {
        const relations: Relations = [];

        const relationKeys: { key: string; type: RelationType }[] = [
            { key: 'parent', type: RelationType.Parent },
            { key: 'child', type: RelationType.Child },
            { key: 'related', type: RelationType.Related }
        ];

        for (const { key, type } of relationKeys) {
            const targets = this.normalizeRelationTargets(frontmatter[key]);
            for (const targetName of targets) {
                try {
                    const targetFile = this.resolveTarget(sourceFile, targetName);
                    if (targetFile) {
                        relations.push({
                            source: sourceFile,
                            target: targetFile,
                            type: type,
                            label: '',
                            infer: false
                        });
                    }
                } catch (error) {
                    console.error(`Shards: Error parsing relation in ${sourceFile.path}:`, error);
                }
            }
        }

        return relations;
    }

    private normalizeRelationTargets(data: unknown): string[] {
        if (Array.isArray(data)) {
            return data.filter((item): item is string => typeof item === 'string');
        }
        if (typeof data === 'string') {
            return [data];
        }
        return [];
    }

    private resolveTarget(sourceFile: TFile, targetName: string): TFile | null {
        const normalized = targetName.startsWith('[[') && targetName.endsWith(']]')
            ? targetName.slice(2, -2)
            : targetName;

        const linkedFile = this.metadataCache.getFirstLinkpathDest(normalized, sourceFile.path);
        if (linkedFile) {
            return linkedFile;
        }

        console.warn(`Shards: Cannot resolve target "${targetName}" from ${sourceFile.path}`);
        return null;
    }

    private expandBraces(str: string): string[] {
        const match = str.match(/\{([^}]+)\}/);
        if (!match) {
            return [str];
        }
        const prefix = str.slice(0, match.index);
        const suffix = str.slice((match.index ?? 0) + match[0].length);
        const options = match[1]
            .split(',')
            .map(option => option.trim())
            .map(option => (option === '_' ? '' : option));

        const expandedSuffixes = this.expandBraces(suffix);
        const result: string[] = [];
        options.forEach(option => {
            expandedSuffixes.forEach(suf => {
                result.push(prefix + option + suf);
            });
        });
        return result;
    }
}