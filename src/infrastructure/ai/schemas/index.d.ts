export type JsonSchema = Record<string, unknown>;
export const schemas: {
 displayBlock:JsonSchema;
 normalizedBlocks:JsonSchema;
 tasks:Record<string,JsonSchema>;
 envelopes:Record<string,JsonSchema>;
 http:Record<string,JsonSchema>;
};
export function validateSchema(schema:JsonSchema,value:unknown):{valid:boolean;errors:string[]};
