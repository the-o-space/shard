export type Unsubscribe = () => void;

export function createStore<S, A>(initial: S, reducer: (state: S, action: A) => S) {
    let state = initial;
    const listeners = new Set<() => void>();

    return {
        getState(): S {
            return state;
        },
        dispatch(action: A): void {
            const next = reducer(state, action);
            if (next !== state) {
                state = next;
                for (const l of listeners) l();
            }
        },
        subscribe(listener: () => void): Unsubscribe {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}

