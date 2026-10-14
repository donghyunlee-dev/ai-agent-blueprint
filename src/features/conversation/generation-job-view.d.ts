import type { GenerationJob, DisplayBlock } from '../../domain/blueprint/types.js';
export function generationJobView(job: GenerationJob | null | undefined): {label:string;completed:number;total:number;completedSteps:number};
export function cancelGenerationJob<T extends {status:string}>(job:T): {job:T| (T & {status:'cancelled';finishedAt:string});blocks:DisplayBlock[]};
export const UNKNOWN_REQUEST_TTL_MS: number;
export function getUnknownRequestRecovery(job: import('../../domain/blueprint/types.js').GenerationJob | null | undefined, now?: number, confirmedJobId?: string | null): {blocked:boolean;expired:boolean;expiresAt?:number;canStartNewIntent:boolean};
