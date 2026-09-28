import { PrdGenerationContext } from "./types";

const STORAGE_KEY = "sfood-agent-blueprint:prd-context";

export function savePrdContext(context: PrdGenerationContext) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export function loadPrdContext(): PrdGenerationContext | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PrdGenerationContext;
  } catch {
    return null;
  }
}
