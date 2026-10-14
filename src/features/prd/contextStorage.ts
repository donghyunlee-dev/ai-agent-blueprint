import type { PrdGenerationContext } from "./types";

const STORAGE_KEY = "windsoft-agent-blueprint:prd-context";
const LEGACY_STORAGE_KEY = "sfood-agent-blueprint:prd-context";

export function savePrdContext(context: PrdGenerationContext) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export function loadPrdContext(): PrdGenerationContext | null {
  const current = sessionStorage.getItem(STORAGE_KEY);
  if (current !== null) {
    const context = parseContext(current);
    if (context) {
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      return context;
    }
  }

  const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return null;

  const context = parseContext(legacy);
  if (!context) {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    return null;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  return context;
}

function parseContext(raw: string): PrdGenerationContext | null {
  try {
    return JSON.parse(raw) as PrdGenerationContext;
  } catch {
    return null;
  }
}
