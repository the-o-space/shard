import { describe, it, expect, vi } from 'vitest';
import { Parser } from '../src/parser/Parser';
import type { MetadataCache, TFile } from 'obsidian';

function makeTFile(path: string): TFile {
    return { path } as unknown as TFile;
}

function makeMetadataCache(resolutions: Record<string, string>): MetadataCache {
    return {
        getFirstLinkpathDest: (linkpath: string, _sourcePath: string) => {
            const resolved = resolutions[linkpath];
            return resolved ? makeTFile(resolved) : null;
        }
    } as unknown as MetadataCache;
}

describe('Parser block-level', () => {
    it('aggregates multiple shards blocks and expands hierarchies', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const file = makeTFile('A.md');
        const cache = makeMetadataCache({
            'Child With Space': 'B.md',
            'Other': 'C.md'
        });
        const parser = new Parser(cache);

        const content = [
            'Intro\n\n',
            '```shards\n',
            '> "Label" Child With Space\n',
            '/Class/Subclass/{Sub1, Sub2}\n',
            '```\n\n',
            'middle\n\n',
            '```shards\n',
            '= Other\n',
            '```\n'
        ].join('');

        const shards = parser.parse(file, content);
        const shard = shards.get(file)!;

        expect(shard).toBeTruthy();
        expect(shard.relations.length).toBe(2);
        expect(shard.hierarchies.length).toBe(2); // Sub1 and Sub2

        const labels = shard.relations.map(r => r.label);
        expect(labels).toContain('Label');

        const targets = shard.relations.map(r => r.target.path);
        expect(targets).toContain('B.md');
        expect(targets).toContain('C.md');

        const hierarchyPaths = shard.hierarchies.map(h => h.path.join('/'));
        expect(hierarchyPaths).toContain('Class/Subclass/Sub1');
        expect(hierarchyPaths).toContain('Class/Subclass/Sub2');

        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('continues after malformed lines', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const file = makeTFile('A.md');
        const cache = makeMetadataCache({ 'B': 'B.md' });
        const parser = new Parser(cache);

        const content = [
            '```shards\n',
            'MALFORMED ???\n',
            '> B\n',
            '```\n'
        ].join('');

        const shards = parser.parse(file, content);
        const shard = shards.get(file)!;
        expect(shard.relations.length).toBe(1);
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});


