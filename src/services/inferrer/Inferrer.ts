import { TFile, Vault, App } from 'obsidian';
import { Relation } from 'src/data/types/Relation';
import { relationTypeToSymbol, getInverseType } from 'src/data/enums/RelationType';
import { Parser } from '../parser/Parser';

export class Inferrer {
    private lastOperationCache: Set<string> = new Set();

    constructor(
        private readonly app: App,
        private readonly vault: Vault,
        private readonly parser: Parser
    ) { }

    async processChanges(_file: TFile, added: Relation[], removed: Relation[]): Promise<void> {
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
        const operationKey = this.getCanonicalKey(relation);
        if (this.lastOperationCache.has(operationKey)) {
            this.lastOperationCache.delete(operationKey);
            return;
        }

        const inverse = this.getInverseRelation(relation);
        const targetFile = relation.target;
        const shards = this.parser.parse(targetFile);
        const shard = shards.get(targetFile);

        const inverseExists = shard?.relations.some(r =>
            r.target.path === inverse.target.path && r.type === inverse.type
        );

        if (inverseExists) {
            return;
        }

        await this.app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
            const key = inverse.type;
            const target = `[[${inverse.target.path}]]`;

            if (frontmatter[key]) {
                if (Array.isArray(frontmatter[key])) {
                    frontmatter[key].push(target);
                } else {
                    frontmatter[key] = [frontmatter[key], target];
                }
            } else {
                frontmatter[key] = target;
            }
        });

        this.lastOperationCache.add(operationKey);
    }

    private async removeInverseRelation(relation: Relation): Promise<void> {
        const operationKey = this.getCanonicalKey(relation);
        if (this.lastOperationCache.has(operationKey)) {
            this.lastOperationCache.delete(operationKey);
            return;
        }

        const inverse = this.getInverseRelation(relation);
        const targetFile = relation.target;
        
        await this.app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
            const key = inverse.type;
            const targetLink = `[[${inverse.target.path}]]`;

            if (frontmatter[key] && Array.isArray(frontmatter[key])) {
                frontmatter[key] = frontmatter[key].filter((item: string) => item !== targetLink);
                if (frontmatter[key].length === 0) {
                    delete frontmatter[key];
                }
            } else if (frontmatter[key] === targetLink) {
                delete frontmatter[key];
            }
        });

        this.lastOperationCache.add(operationKey);
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


