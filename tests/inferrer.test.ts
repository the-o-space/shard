import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Inferrer } from '../src/services/inferrer/Inferrer';
import { Parser } from '../src/services/parser/Parser';
import type { TFile, Vault, MetadataCache, App } from 'obsidian';
import { Relation } from 'src/data/types/Relation';

const makeTFile = (path: string): TFile => ({ path } as TFile);

const makeMockApp = () => {
    const frontmatter: Record<string, any> = {};
    return {
        fileManager: {
            processFrontMatter: vi.fn(async (file: TFile, callback: (fm: any) => void) => {
                const current = frontmatter[file.path] || {};
                callback(current);
                frontmatter[file.path] = current;
            }),
        },
        _getFrontmatter: (path: string) => frontmatter[path],
        _setFrontmatter: (path: string, data: any) => {
            frontmatter[path] = data;
        },
    }
};

const makeMockVault = () => {
    const files: Record<string, string> = {};
    return {
        read: vi.fn(async (file: TFile) => files[file.path] || ''),
        modify: vi.fn(async (file: TFile, content: string) => {
            files[file.path] = content;
        }),
        _getFiles: () => files,
        _setFileContent: (path: string, content: string) => {
            files[path] = content;
        }
    };
};

const makeMockMetadataCache = (app: ReturnType<typeof makeMockApp>): MetadataCache => ({
    getCache: (path: string) => ({
        frontmatter: app._getFrontmatter(path) || {},
    }),
    getFirstLinkpathDest: (linkpath: string, sourcePath: string): TFile | null => {
        if (linkpath === '[[A.md]]' || linkpath === 'A.md') return makeTFile('A.md');
        if (linkpath === '[[B.md]]' || linkpath === 'B.md') return makeTFile('B.md');
        return null;
    },
} as unknown as MetadataCache);


describe('Inferrer Service', () => {
    let vault: ReturnType<typeof makeMockVault>;
    let parser: Parser;
    let inferrer: Inferrer;
    let app: ReturnType<typeof makeMockApp>;

    beforeEach(() => {
        vault = makeMockVault();
        app = makeMockApp();
        const metadataCache = makeMockMetadataCache(app);
        parser = new Parser(metadataCache);
        inferrer = new Inferrer(app as unknown as App, vault as unknown as Vault, parser);
    });

    it('should add an inverse relation when a new relation is added', async () => {
        const fileA = makeTFile('A.md');
        const fileB = makeTFile('B.md');
        app._setFrontmatter('B.md', {});

        // In A, a relation is added: child: [[B.md]]
        const addedRelation: Relation = {
            source: fileA,
            target: fileB,
            type: 'child',
            label: '',
            infer: false,
        };

        await inferrer.processChanges(fileA, [addedRelation], []);

        const fmB = app._getFrontmatter('B.md');
        // In B, we should see parent: [[A.md]]
        expect(fmB.parent).toBe('[[A.md]]');
    });

    it('should remove an inverse relation when a relation is removed', async () => {
        const fileA = makeTFile('A.md');
        const fileB = makeTFile('B.md');
        app._setFrontmatter('B.md', { parent: '[[A.md]]' });

        const removedRelation: Relation = {
            source: fileA,
            target: fileB,
            type: 'child',
            label: '',
            infer: false,
        };

        await inferrer.processChanges(fileA, [], [removedRelation]);

        const fmB = app._getFrontmatter('B.md');
        expect(fmB.parent).toBeUndefined();
    });

    it('should not add a duplicate inverse relation if one already exists', async () => {
        const fileA = makeTFile('A.md');
        const fileB = makeTFile('B.md');
        const initialFmB = { parent: '[[A.md]]' };
        app._setFrontmatter('B.md', initialFmB);
        vi.spyOn(parser, 'parse').mockReturnValue(new Map([
            [fileB, {
                file: fileB,
                hierarchies: [],
                relations: [{ source: fileB, target: fileA, type: 'parent', label: '', infer: false }]
            }]
        ]));

        const addedRelation: Relation = {
            source: fileA,
            target: fileB,
            type: 'child',
            label: '',
            infer: false,
        };

        await inferrer.processChanges(fileA, [addedRelation], []);

        const fmB = app._getFrontmatter('B.md');
        expect(fmB).toEqual(initialFmB);
    });

    it('should not modify the source file when adding a relation', async () => {
        const fileA = makeTFile('A.md');
        const fileB = makeTFile('B.md');
        app._setFrontmatter('A.md', { child: '[[B.md]]' });
        app._setFrontmatter('B.md', {});

        const addedRelation: Relation = {
            source: fileA,
            target: fileB,
            type: 'child',
            label: '',
            infer: false,
        };

        const initialFmA = { ...app._getFrontmatter('A.md') };
        await inferrer.processChanges(fileA, [addedRelation], []);
        const finalFmA = app._getFrontmatter('A.md');
        expect(finalFmA).toEqual(initialFmA);
    });

    it('should not trigger an infinite loop', async () => {
        const fileA = makeTFile('A.md');
        const fileB = makeTFile('B.md');
        app._setFrontmatter('A.md', {});
        app._setFrontmatter('B.md', {});

        const relationAtoB: Relation = { source: fileA, target: fileB, type: 'child', label: '', infer: false };
        const relationBtoA: Relation = { source: fileB, target: fileA, type: 'parent', label: '', infer: false };

        // 1. User adds "child: [[B.md]]" to A.md
        await inferrer.processChanges(fileA, [relationAtoB], []);
        expect(app._getFrontmatter('B.md').parent).toBe('[[A.md]]');

        // 2. B reparses and reports "parent: [[A.md]]". This should not trigger adding back in A
        const originalFmA = { ...app._getFrontmatter('A.md') };
        await inferrer.processChanges(fileB, [relationBtoA], []);

        const finalFmA = app._getFrontmatter('A.md');
        expect(finalFmA).toEqual(originalFmA);
    });
});
