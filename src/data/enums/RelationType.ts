export const RelationType = {
    Child: 'child',
    Parent: 'parent',
    Related: 'related',
} as const;

export type RelationType = typeof RelationType[keyof typeof RelationType];

const relationSymbols: { [key: string]: RelationType } = {
    ">": RelationType.Child,
    "<": RelationType.Parent,
    "=": RelationType.Related,
};

export const relationSymbolToType = (symbol: string): RelationType => {
    const type = relationSymbols[symbol];
    if (type) {
        return type;
    }
    throw new Error(`Invalid relation symbol: ${symbol}, no type found`);
}

export const relationTypeToSymbol = (type: RelationType): string | undefined => {
    for (const symbol in relationSymbols) {
        if (relationSymbols[symbol] === type) {
            return symbol;
        }
    }
    return undefined;
}

export const getInverseType = (type: RelationType): RelationType => {
    switch (type) {
        case RelationType.Parent:
            return RelationType.Child;
        case RelationType.Child:
            return RelationType.Parent;
        case RelationType.Related:
        default:
            return RelationType.Related;
    }
}