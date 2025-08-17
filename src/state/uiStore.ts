import { createStore } from './tinyStore';
import type { UiState } from './uiTypes';
import { defaultUiState } from './uiTypes';

export type UiActions =
  | { type: 'set'; payload: Partial<UiState> }
  | { type: 'toggle-section'; payload: { which: 'tree' | 'relations' } }
  | { type: 'set-tree-expanded'; payload: string[] }
  | { type: 'set-tree-scroll'; payload: number }
  | { type: 'set-tree-height'; payload: number | null }
  | { type: 'set-relations-scroll'; payload: number };

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

function reducer(state: UiState, action: UiActions): UiState {
  switch (action.type) {
    case 'set':
      return deepMerge(state, action.payload);
    case 'toggle-section': {
      if (action.payload.which === 'tree') {
        return { ...state, sections: { ...state.sections, treeCollapsed: !state.sections.treeCollapsed } };
      } else {
        return { ...state, sections: { ...state.sections, relationsCollapsed: !state.sections.relationsCollapsed } };
      }
    }
    case 'set-tree-expanded':
      return { ...state, tree: { ...state.tree, expandedPaths: action.payload } };
    case 'set-tree-scroll':
      return { ...state, tree: { ...state.tree, scrollTop: action.payload } };
    case 'set-tree-height':
      return { ...state, tree: { ...state.tree, heightPx: action.payload } };
    case 'set-relations-scroll':
      return { ...state, relations: { ...state.relations, scrollTop: action.payload } };
    default:
      return state;
  }
}

export const uiStore = createStore<UiState, UiActions>(defaultUiState, reducer);

