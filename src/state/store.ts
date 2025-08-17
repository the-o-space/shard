import { createStore } from '../state/tinyStore';
import type { ShardDataState, RelationDTO, HierarchyDTO } from './types';

const initialState: ShardDataState = {
    relations: [],
    hierarchies: []
};

export type ShardActions =
    | { type: 'reset' }
    | { type: 'set-all'; payload: ShardDataState }
    | { type: 'add-relations'; payload: RelationDTO[] }
    | { type: 'add-hierarchies'; payload: HierarchyDTO[] }
    | { type: 'remove-file'; payload: { filePath: string } }
    | { type: 'rename-file'; payload: { oldPath: string; newPath: string } };

function reducer(state: ShardDataState, action: ShardActions): ShardDataState {
    switch (action.type) {
        case 'reset':
            return { relations: [], hierarchies: [] };
        case 'set-all':
            return { ...action.payload };
        case 'add-relations':
            return { ...state, relations: [...state.relations, ...action.payload] };
        case 'add-hierarchies':
            return { ...state, hierarchies: [...state.hierarchies, ...action.payload] };
        case 'remove-file':
            return {
                relations: state.relations.filter(r => r.sourcePath !== action.payload.filePath && r.targetPath !== action.payload.filePath),
                hierarchies: state.hierarchies.filter(h => h.filePath !== action.payload.filePath)
            };
        case 'rename-file':
            return {
                relations: state.relations.map(r => ({
                    ...r,
                    sourcePath: r.sourcePath === action.payload.oldPath ? action.payload.newPath : r.sourcePath,
                    targetPath: r.targetPath === action.payload.oldPath ? action.payload.newPath : r.targetPath
                })),
                hierarchies: state.hierarchies.map(h => ({
                    ...h,
                    filePath: h.filePath === action.payload.oldPath ? action.payload.newPath : h.filePath
                }))
            };
        default:
            return state;
    }
}

export const shardStore = createStore(initialState, reducer);

