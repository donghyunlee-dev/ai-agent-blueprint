export type ProjectSaveState = { status: 'saving' | 'saved' | 'failed'; savedAt: string | null };
export function createDebouncedProjectSaver<T>({ save, onState, delay, setTimeout, clearTimeout }: { save: (snapshot: T) => Promise<unknown>; onState?: (state: ProjectSaveState) => void; delay?: number; setTimeout?: typeof globalThis.setTimeout; clearTimeout?: typeof globalThis.clearTimeout }): {
  schedule(snapshot: T): void;
  flush(): Promise<void>;
  retry(): Promise<void>;
  getSnapshot(): T | null;
  getState(): ProjectSaveState;
  dispose(): void;
};
export function formatSavedTime(isoTimestamp: string | null | undefined): string;
