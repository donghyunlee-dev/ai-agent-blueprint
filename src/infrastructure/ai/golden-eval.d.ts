export interface GoldenFixture { id:string; task:string; schemaVersion:string; response:unknown; manifest:Record<string,unknown>; targetContext?:Record<string,unknown> }
export function evaluateGoldenFixture(fixture:GoldenFixture):{pass:boolean;errors:string[]};
export function inspectProhibitedOutcomes(response:unknown):string[];
