import { createStore } from './tinyStore';
import type { ShardDataState } from './types';
import type { UiState } from './uiTypes';
import { defaultUiState } from './uiTypes';

// Shards domain
export type RelationDTO = import('./types').RelationDTO;
export type HierarchyDTO = import('./types').HierarchyDTO;

const initialShards: ShardDataState = { relations: [], hierarchies: [] };

export type ShardActions =
  | { type: 'shards/reset' }
  | { type: 'shards/set-all'; payload: ShardDataState }
  | { type: 'shards/add-relations'; payload: RelationDTO[] }
  | { type: 'shards/add-hierarchies'; payload: HierarchyDTO[] }
  | { type: 'shards/remove-file'; payload: { filePath: string } }
  | { type: 'shards/rename-file'; payload: { oldPath: string; newPath: string } };

function shardsReducer(state: ShardDataState = initialShards, action: ShardActions): ShardDataState {
  switch (action.type) {
    case 'shards/reset':
      return { relations: [], hierarchies: [] };
    case 'shards/set-all':
      return { ...action.payload };
    case 'shards/add-relations':
      return { ...state, relations: [...state.relations, ...action.payload] };
    case 'shards/add-hierarchies':
      return { ...state, hierarchies: [...state.hierarchies, ...action.payload] };
    case 'shards/remove-file':
      return {
        relations: state.relations.filter(r => r.sourcePath !== action.payload.filePath && r.targetPath !== action.payload.filePath),
        hierarchies: state.hierarchies.filter(h => h.filePath !== action.payload.filePath)
      };
    case 'shards/rename-file':
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

// UI domain
export type UiActions =
  | { type: 'ui/set'; payload: Partial<UiState> }
  | { type: 'ui/toggle-section'; payload: { which: 'tree' | 'relations' } }
  | { type: 'ui/set-tree-expanded'; payload: string[] }
  | { type: 'ui/set-tree-scroll'; payload: number }
  | { type: 'ui/set-tree-height'; payload: number | null }
  | { type: 'ui/set-relations-scroll'; payload: number };

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge((base as any)[k] ?? {}, v as any);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function uiReducer(state: UiState = defaultUiState, action: UiActions): UiState {
  switch (action.type) {
    case 'ui/set':
      return deepMerge(state, action.payload);
    case 'ui/toggle-section':
      return action.payload.which === 'tree'
        ? { ...state, sections: { ...state.sections, treeCollapsed: !state.sections.treeCollapsed } }
        : { ...state, sections: { ...state.sections, relationsCollapsed: !state.sections.relationsCollapsed } };
    case 'ui/set-tree-expanded':
      return { ...state, tree: { ...state.tree, expandedPaths: action.payload } };
    case 'ui/set-tree-scroll':
      return { ...state, tree: { ...state.tree, scrollTop: action.payload } };
    case 'ui/set-tree-height':
      return { ...state, tree: { ...state.tree, heightPx: action.payload } };
    case 'ui/set-relations-scroll':
      return { ...state, relations: { ...state.relations, scrollTop: action.payload } };
    default:
      return state;
  }
}

export type RootState = {
  shards: ShardDataState;
  ui: UiState;
};

export type RootAction = ShardActions | UiActions;

function rootReducer(state: RootState, action: RootAction): RootState {
  return {
    shards: shardsReducer(state?.shards, action as ShardActions),
    ui: uiReducer(state?.ui, action as UiActions)
  };
}

export const rootInitialState: RootState = {
  shards: initialShards,
  ui: defaultUiState
};

export const rootStore = createStore<RootState, RootAction>(rootInitialState, rootReducer);

