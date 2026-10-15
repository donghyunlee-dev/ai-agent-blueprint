import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
export function previewDocumentImpact(aggregate:BlueprintAggregate,documentId:string,targets:{sectionIds:string[];requirementIds:string[]}):{targetIds:string[];itemIds:string[];documentIds:string[]};
