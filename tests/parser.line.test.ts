import { describe, it, expect } from 'vitest';
import { language, RelationParseResult } from '../src/parser/Regex';

describe('Parser line-level', () => {
    it('parses relation without label and target with spaces', () => {
        const input = '> Child With Space';
        const result = language.relationLine.parse(input);
        if (!result.status) throw new Error('parse failed');
        const value = result.value as RelationParseResult;
        expect(value.symbol).toBe('>');
        expect(value.label).toBe('');
        expect(value.target).toBe('Child With Space');
    });

    it('parses relation with label and target with spaces', () => {
        const input = '> "Label" Child With Space';
        const result = language.relationLine.parse(input);
        if (!result.status) throw new Error('parse failed');
        const value = result.value as RelationParseResult;
        expect(value.symbol).toBe('>');
        expect(value.label).toBe('Label');
        expect(value.target).toBe('Child With Space');
    });

    it('rejects relation without target', () => {
        const input = '>';
        const result = language.relationLine.parse(input);
        expect(result.status).toBe(false);
    });

    it('parses hierarchy path and brace expansion shape', () => {
        const input = '/Class/Subclass/{Sub1, Sub2}';
        const result = language.hierarchyLine.parse(input);
        if (!result.status) throw new Error('parse failed');
        // Content shape is a string; further expansion tested in block tests
        expect(typeof result.value).toBe('string');
    });
});


