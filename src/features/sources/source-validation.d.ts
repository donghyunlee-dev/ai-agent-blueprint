export const MAX_SOURCE_FILE_BYTES: number;
export const MAX_ACTIVE_SOURCES: number;
export const SOURCE_ERROR_MESSAGES: Record<string, string>;
export function validateSourceFile(file: { name: string; size: number; type?: string }): { valid: true; extension: string; mediaType: string } | { valid: false; errorCode: string };
export function countActiveSources(sources: { archivedAt?: string }[]): number;
