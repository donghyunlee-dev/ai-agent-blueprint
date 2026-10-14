export interface GoldenFixture { id:string; task:string; schemaVersion:string; response:unknown; manifest?:Record<string,unknown>; targetContext?:Record<string,unknown>; forbiddenResults?:string[] }
export function evaluateGoldenFixture(fixture:GoldenFixture):{pass:boolean;errors:string[]};
