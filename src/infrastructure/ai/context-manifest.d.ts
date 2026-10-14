import type { ContextManifest } from '../../domain/blueprint/types.js';
export function validateReferences(response:Record<string,unknown>,manifest:ContextManifest):{valid:boolean;errors:string[]};
export function validateResponseMetadata(response:Record<string,unknown>,expected:Record<string,unknown>):{valid:boolean;errors:string[]};
