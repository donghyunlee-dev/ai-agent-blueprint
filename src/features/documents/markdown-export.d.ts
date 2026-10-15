import type { DocumentSection, GeneratedDocument } from '../../domain/blueprint/types.js';

export function serializeDocumentMarkdown(document: GeneratedDocument, sections: DocumentSection[]): string;
export function createDocumentFilename(projectTitle: string, documentType: GeneratedDocument['type']): string;
export function downloadMarkdown(markdown: string, filename: string, dependencies?: Record<string, any>): void;
