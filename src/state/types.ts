export type RelationDTO = {
    sourcePath: string;
    targetPath: string;
    type: 'parent' | 'child' | 'related';
    label: string;
    infer: boolean;
};

export type HierarchyDTO = {
    filePath: string;
    path: string[];
};

export type ShardDataState = {
    relations: RelationDTO[];
    hierarchies: HierarchyDTO[];
};

