import type { GenerationJob, DisplayBlock } from '../../domain/blueprint/types.js';
export function generationJobView(job: GenerationJob | null | undefined): {label:string;completed:number;total:number;completedSteps:number};
export function cancelGenerationJob<T extends {status:string}>(job:T): {job:T| (T & {status:'cancelled';finishedAt:string});blocks:DisplayBlock[]};
