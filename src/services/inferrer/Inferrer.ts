import { TFile, Vault, App } from 'obsidian';
import { Relation } from 'src/data/types/Relation';
import { getInverseType } from 'src/data/enums/RelationType';
import { Parser } from '../parser/Parser';

export class Inferrer {
    private lastOperationCache: Set<string> = new Set();

    constructor(
        private readonly app: App,
        private readonly vault: Vault,
        private readonly parser: Parser
    ) { }

    async processChanges(_file: TFile, added: Relation[], removed: Relation[]): Promise<void> {
        console.debug('[Shards][Inferrer] processChanges', {
            file: _file.path,
            added: added.map(r => ({ s: r.source.path, t: r.target.path, type: r.type })),
            removed: removed.map(r => ({ s: r.source.path, t: r.target.path, type: r.type }))
        });
        for (const relation of removed) {
            await this.removeInverseRelation(relation);
        }

        for (const relation of added) {
            await this.addInverseRelation(relation);
        }
    }
    
    private getCanonicalKey(relation: Relation): string {
        const files = [relation.source.path, relation.target.path].sort();
        const types = [relation.type, getInverseType(relation.type)].sort();
        return `${files[0]}|${files[1]}|${types[0]}|${types[1]}`;
    }

    private async addInverseRelation(relation: Relation): Promise<void> {
        // Skip self-relations to avoid a file linking to itself
        if (relation.source.path === relation.target.path) {
            console.debug('[Shards][Inferrer] Skipping self-relation', relation);
            return;
        }

        const operationKey = this.getCanonicalKey(relation);
        if (this.lastOperationCache.has(operationKey)) {
            console.debug('[Shards][Inferrer] Skipping cached addInverseRelation', { operationKey });
            this.lastOperationCache.delete(operationKey);
            return;
        }

        const inverse = this.getInverseRelation(relation);
        const targetFile = relation.target;
        console.debug('[Shards][Inferrer] addInverseRelation -> target', {
            source: relation.source.path,
            target: targetFile.path,
            inverseType: inverse.type
        });

        // Check if inverse already exists (based on parsed cache)
        const shards = this.parser.parse(targetFile);
        const shard = shards.get(targetFile);
        const inverseExists = shard?.relations.some(r =>
            r.target.path === inverse.target.path && r.type === inverse.type
        );
        if (inverseExists) {
            console.debug('[Shards][Inferrer] Inverse already exists, not adding', {
                target: targetFile.path,
                inverseTarget: inverse.target.path,
                type: inverse.type
            });
            return;
        }

        // Log current frontmatter prior to change
        const beforeFm = this.app.metadataCache.getCache(targetFile.path)?.frontmatter;
        console.debug('[Shards][Inferrer] Frontmatter before add', { file: targetFile.path, frontmatter: beforeFm });

        await this.app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
            const key = inverse.type as string;
            const target = `[[${inverse.target.path}]]`;

            const ensureArray = (val: unknown): string[] => Array.isArray(val) ? val as string[] : (typeof val === 'string' && val.length > 0 ? [val] : []);

            const currentValues = ensureArray(frontmatter[key]);
            if (!currentValues.includes(target)) {
                frontmatter[key] = [...currentValues, target];
            }
        });

        this.lastOperationCache.add(operationKey);

        const afterFm = this.app.metadataCache.getCache(targetFile.path)?.frontmatter;
        console.debug('[Shards][Inferrer] Frontmatter after add', { file: targetFile.path, frontmatter: afterFm });
    }

    private async removeInverseRelation(relation: Relation): Promise<void> {
        // Skip self-relations
        if (relation.source.path === relation.target.path) {
            console.debug('[Shards][Inferrer] Skipping self-relation removal', relation);
            return;
        }

        const operationKey = this.getCanonicalKey(relation);
        if (this.lastOperationCache.has(operationKey)) {
            console.debug('[Shards][Inferrer] Skipping cached removeInverseRelation', { operationKey });
            this.lastOperationCache.delete(operationKey);
            return;
        }

        const inverse = this.getInverseRelation(relation);
        const targetFile = relation.target;
        console.debug('[Shards][Inferrer] removeInverseRelation -> target', {
            source: relation.source.path,
            target: targetFile.path,
            inverseType: inverse.type
        });
        
        const beforeFm = this.app.metadataCache.getCache(targetFile.path)?.frontmatter;
        console.debug('[Shards][Inferrer] Frontmatter before remove', { file: targetFile.path, frontmatter: beforeFm });

        await this.app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
            const key = inverse.type as string;
            const targetLink = `[[${inverse.target.path}]]`;

            if (Array.isArray(frontmatter[key])) {
                const next = (frontmatter[key] as string[]).filter((item: string) => item !== targetLink);
                if (next.length > 0) {
                    frontmatter[key] = next;
                } else {
                    delete frontmatter[key];
                }
            } else if (frontmatter[key] === targetLink) {
                delete frontmatter[key];
            }
        });

        this.lastOperationCache.add(operationKey);

        const afterFm = this.app.metadataCache.getCache(targetFile.path)?.frontmatter;
        console.debug('[Shards][Inferrer] Frontmatter after remove', { file: targetFile.path, frontmatter: afterFm });
    }

    private getInverseRelation(relation: Relation): Relation {
        const inverseType = getInverseType(relation.type);
        return {
            source: relation.target,
            target: relation.source,
            type: inverseType,
            label: relation.label,
            infer: false,
        };
    }
}


