import type { SourceDocument } from '../../domain/blueprint/types.js';

export interface SelectedSourceExcerpt { id:string; sourceId:string; text:string; location:string }
export function selectSourceExcerpts(input: { projectId:string; query:string; sources:SourceDocument[]; idFactory?:()=>string }): SelectedSourceExcerpt[];
export const sourceExcerptLimits: Readonly<{ perSourceParagraphs:number; perSourceCharacters:number; requestCharacters:number }>;
