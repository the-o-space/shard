export const RelationType = {
    Child: 'child',
    Parent: 'parent',
    Related: 'related',
} as const;

export type RelationType = typeof RelationType[keyof typeof RelationType];

const relationSymbols = {
    ">": RelationType.Child,
    "<": RelationType.Parent,
    "=": RelationType.Related,
}

export const relationSymbolToType = (symbol: string): RelationType => {
    try {
        return relationSymbols[symbol as keyof typeof relationSymbols];
    } catch (error) {
        throw new Error(`Invalid relation symbol: ${symbol}, no type found`);
    }
}

export const relationTypeToSymbol = (type: RelationType): string | undefined => {
    try {
        return Object.keys(relationSymbols).find(key => relationSymbols[key as keyof typeof relationSymbols] === type);
    } catch (error) {
        throw new Error(`Invalid relation type: ${type}, no symbol found`);
    }
}