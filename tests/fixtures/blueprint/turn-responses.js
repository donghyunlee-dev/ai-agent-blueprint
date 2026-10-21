export const validTurnResponse = {
  task:'TURN_ANALYZE', promptVersion:'v2', schemaVersion:'v2', designRevision:1,
  payload:{ blocks:[{type:'assistant_text',content:'말씀하신 내용을 확인했습니다.'}], proposals:[], answerInterpretation:{directAnswer:'온라인 서비스',additionalFacts:[],ambiguities:[]} },
  referencedItemIds:[], referencedSourceIds:[], warnings:[],
};
export const partialTurnResponse = { ...validTurnResponse, payload:{ blocks:[],proposals:[],answerInterpretation:{additionalFacts:[],ambiguities:[]} } };
export const emptyProposalTurnResponse = { ...partialTurnResponse, payload:{ ...partialTurnResponse.payload, proposals:[] } };
export const extraFieldTurnResponse = { ...validTurnResponse, unexpected:'not allowed' };
export const unknownEnumTurnResponse = { ...validTurnResponse, payload:{ ...validTurnResponse.payload, proposals:[{operation:'merge',targetType:'design_item',rationale:'x',evidence:[],affectedItemIds:[]}] } };
