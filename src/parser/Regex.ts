import * as P from 'parsimmon';

export type RelationSymbol = '>' | '<' | '=';

export interface RelationParseResult {
    symbol: RelationSymbol;
    label: string;
    target: string;
}

export const language = P.createLanguage<{
    whitespace: string;
    newline: string;
    relationType: RelationSymbol;
    quotedLabel: string;
    targetName: string;
    targetRemainder: string;
    hierarchyLine: string;
    relationLine: RelationParseResult;
    comment: null;
    emptyLine: null;
    line: RelationParseResult | null;
    blockContent: RelationParseResult[];
    shardsBlock: string;
    allBlocks: string[];
}>({
    // Basic tokens
    whitespace: () => P.regexp(/[ \t]*/),
    newline: () => P.regexp(/\r?\n/),

    // Relation type symbols
    relationType: () => P.regexp(/[<>=]/).map(symbol => symbol as RelationSymbol),

    // Quoted label (optional)
    quotedLabel: () =>
        P.string('"')
            .then(P.regexp(/[^\"]*/).desc('label content'))
            .skip(P.string('"')),

    // Target name (single token) retained for potential future use
    targetName: () =>
        P.alt(
            P.string('[[')
                .then(P.regexp(/[^\]]+/))
                .skip(P.string(']]')),
            P.regexp(/\S+/)
        ),

    // Target remainder: the rest of the line (allows spaces)
    // We require at least one non-whitespace character to ensure a target exists
    targetRemainder: () =>
        P.regexp(/[^\r\n]*\S[^\r\n]*/).map(s => s.trim()),

    // Hierarchy line parser
    hierarchyLine: () =>
        P.regexp(/[a-zA-Z0-9_\-\/\s{},.]+/)
            .trim(P.optWhitespace)
            .desc('hierarchy path'),

    // Complete relation line
    relationLine: (r) =>
        P.seq(
            r.relationType,
            r.whitespace,
            P.seq(
                r.quotedLabel.trim(r.whitespace),
                r.targetRemainder
            ).or(
                r.targetRemainder.map(name => ['', name])
            )
        ).map(([symbol, _ws, [label, target]]) => ({
            symbol,
            label: label ?? '',
            target
        })),

    // Comment line
    comment: () =>
        P.string('#')
            .then(P.regexp(/.*/))
            .map(() => null),

    // Empty line
    emptyLine: () =>
        P.regexp(/[ \t]*/)
            .map(() => null),

    // Any line in the block
    line: (r) =>
        P.alt(
            r.comment,
            r.emptyLine,
            r.relationLine
        ),

    // Complete shards block content (currently unused externally)
    blockContent: (r) =>
        P.sepBy(r.line, r.newline)
            .map(lines => (lines.filter(l => l !== null) as RelationParseResult[])),

    // Code block with ```shards
    shardsBlock: (r) =>
        P.seq(
            P.string('```shards'),
            P.regexp(/[ \t]*/),
            r.newline,
            P.regexp(/[\s\S]*?(?=```)/).skip(P.string('```'))
        ).map(([_, __, ___, content]) => content),

    // Find all shards blocks in content
    allBlocks: (r) =>
        P.alt(
            P.seq(
                P.regexp(/[\s\S]*?(?=```shards)/),
                r.shardsBlock,
                r.allBlocks.or(P.all)
            ).map(([_, block, rest]) => [block, ...rest]),
            P.all.map(() => [])
        )
});