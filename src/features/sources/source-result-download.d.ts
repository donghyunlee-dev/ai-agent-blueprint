import type { SourceDocument } from '../../domain/blueprint/types.js';

export function canDownloadSourceResult(source: Partial<SourceDocument> | null | undefined): boolean;
export function createSourceResultFilename(fileName: string): string;
export function downloadSourceResult(source: SourceDocument, dependencies?: Record<string, any>): void;
