import type { AiTaskType } from '../../domain/blueprint/types.js';
import type { JsonSchema } from './schemas/index.js';
export function getSchemaDefinition(id:string,version?:string):JsonSchema;
export function getSchemaDefinitionAtVersion(id:string,version:string):JsonSchema;
export function getSchemaRegistry():Record<string,{id:string;version:string;task:AiTaskType;schema:JsonSchema}>;
