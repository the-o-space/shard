import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Parser } from '../src/services/parser/Parser';
import { TFile, MetadataCache } from 'obsidian';
import { RelationType } from '../src/data/enums/RelationType';

const mockMetadataCache = {
    getCache: vi.fn(),
    getFirstLinkpathDest: vi.fn()
};

const createFile = (path: string, frontmatter: any): TFile => {
    mockMetadataCache.getCache.mockReturnValue({ frontmatter });
    return { path } as TFile;
};

describe('Parser with Frontmatter', () => {
    let parser: Parser;

    beforeEach(() => {
        parser = new Parser(mockMetadataCache as unknown as MetadataCache);
        mockMetadataCache.getCache.mockClear();
        mockMetadataCache.getFirstLinkpathDest.mockClear();
    });

    it('should parse hierarchies from a single string', () => {
        const file = createFile('test.md', { hierarchy: 'a/b/c' });
        const shards = parser.parse(file);
        const shard = shards.get(file);
        expect(shard?.hierarchies).toEqual([{ path: ['a', 'b', 'c'], label: '' }]);
    });

    it('should parse hierarchies from a list of strings', () => {
        const file = createFile('test.md', { hierarchy: ['a/b', 'x/y'] });
        const shards = parser.parse(file);
        const shard = shards.get(file);
        expect(shard?.hierarchies).toEqual([
            { path: ['a', 'b'], label: '' },
            { path: ['x', 'y'], label: '' }
        ]);
    });

    it('should expand braces in hierarchies', () => {
        const file = createFile('test.md', { hierarchy: 'a/{b,c}/d' });
        const shards = parser.parse(file);
        const shard = shards.get(file);
        expect(shard?.hierarchies).toEqual([
            { path: ['a', 'b', 'd'], label: '' },
            { path: ['a', 'c', 'd'], label: '' }
        ]);
    });

    it('should parse parent relations', () => {
        const sourceFile = createFile('source.md', { parent: '[[parent.md]]' });
        const targetFile = { path: 'parent.md' } as TFile;
        mockMetadataCache.getFirstLinkpathDest.mockReturnValue(targetFile);

        const shards = parser.parse(sourceFile);
        const shard = shards.get(sourceFile);

        expect(shard?.relations).toHaveLength(1);
        expect(shard?.relations[0]).toEqual({
            source: sourceFile,
            target: targetFile,
            type: RelationType.Parent,
            label: '',
            infer: false
        });
    });

    it('should parse child relations from a list', () => {
        const sourceFile = createFile('source.md', { child: ['[[child1.md]]', '[[child2.md]]'] });
        const child1 = { path: 'child1.md' } as TFile;
        const child2 = { path: 'child2.md' } as TFile;
        
        mockMetadataCache.getFirstLinkpathDest.mockImplementation((link: string, _: string) => {
            if (link === 'child1.md') return child1;
            if (link === 'child2.md') return child2;
            return null;
        });

        const shards = parser.parse(sourceFile);
        const shard = shards.get(sourceFile);

        expect(shard?.relations).toHaveLength(2);
        expect(shard?.relations).toContainEqual({
            source: sourceFile,
            target: child1,
            type: RelationType.Child,
            label: '',
            infer: false
        });
        expect(shard?.relations).toContainEqual({
            source: sourceFile,
            target: child2,
            type: RelationType.Child,
            label: '',
            infer: false
        });
    });

    it('should handle unresolved links gracefully', () => {
        const file = createFile('test.md', { related: '[[nonexistent.md]]' });
        mockMetadataCache.getFirstLinkpathDest.mockReturnValue(null);
        
        const shards = parser.parse(file);
        const shard = shards.get(file);
        
        expect(shard?.relations).toHaveLength(0);
    });
});
