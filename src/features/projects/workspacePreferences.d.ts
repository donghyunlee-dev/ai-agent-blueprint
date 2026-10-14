export function clampScrollOffset(offset:number, scrollHeight:number, clientHeight:number):number;
export function clampConversationWidth(width:number):number;
export function getConversationScrollTop(projectId:string, storage?:Storage):number|null;
export function setConversationScrollTop(projectId:string, offset:number, storage?:Storage):boolean;
export function getConversationWidth(projectId:string, storage?:Storage):number|null;
export function setConversationWidth(projectId:string, width:number, storage?:Storage):boolean;
