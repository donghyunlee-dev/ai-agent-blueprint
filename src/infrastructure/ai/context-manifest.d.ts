import type { ContextManifest } from '../../domain/blueprint/types.js';
export function validateReferences(response:Record<string,unknown>,manifest:ContextManifest,targetContext:{designItems?:{id:string}[];acceptanceCriteria?:({id:string}|string)[];documentSections?:({id:string}|string)[]}):{valid:boolean;errors:string[]};
export function validateResponseMetadata(response:Record<string,unknown>,expected:Record<string,unknown>):{valid:boolean;errors:string[]};
export function validateTurnContext(request:Record<string,unknown>,canonical:{projectId:string;designItems?:{id:string;projectId:string;type:string;status:string}[];sourceDocuments?:{id:string;projectId:string;extractionStatus:string}[]}):{valid:boolean;errors:string[]};
export function validateProposalTargets(proposals:Record<string,unknown>[],context?:{designItems?:{id:string}[];acceptanceCriteria?:({id:string}|string)[];documentSections?:({id:string}|string)[]}):{valid:boolean;errors:string[]};
