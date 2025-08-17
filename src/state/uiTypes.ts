export type UiState = {
    sections: {
        treeCollapsed: boolean;
        relationsCollapsed: boolean;
    };
    tree: {
        expandedPaths: string[];
        scrollTop: number;
        heightPx: number | null;
    };
    relations: {
        scrollTop: number;
    };
};

export const defaultUiState: UiState = {
    sections: {
        treeCollapsed: false,
        relationsCollapsed: false,
    },
    tree: {
        expandedPaths: [],
        scrollTop: 0,
        heightPx: null,
    },
    relations: {
        scrollTop: 0,
    }
};

