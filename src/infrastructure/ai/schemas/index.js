const opt = value => ({ ...value, optional: true });
const string = { type: 'string', minLength: 1 };
const boundedString = (maxLength) => ({ type: 'string', pattern: `^.{1,${maxLength}}$` });
const strings = { type: 'array', items: string };
const enumeration = (...values) => ({ type: 'string', enum: values });
const object = (props, required = Object.keys(props).filter(key => props[key]?.optional !== true)) => ({
  type: 'object', properties: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'optional'))])), required, additionalProperties: false,
});
const array = (items, maxItems) => ({ type: 'array', items, ...(maxItems === undefined ? {} : { maxItems }) });
const evidence = object({ sourceType: enumeration('message', 'file', 'user_edit', 'agent_inference'), sourceId: string, excerpt: opt(string), location: opt(string) }, ['sourceType', 'sourceId']);
const proposal = object({ operation: enumeration('create', 'update', 'delete'), targetType: enumeration('design_item', 'acceptance_criterion', 'document_section'), targetId: opt(string), before: opt({}), after: opt({}), rationale: string, evidence: array(evidence), affectedItemIds: strings });
const option = object({ value: string, label: string, description: opt(string), recommended: opt({ type: 'boolean' }), recommendationReason: opt(string), proposalDraft: opt(proposal) }, ['value', 'label']);
const question = object({ type: { const: 'question' }, id: string, topic: string, prompt: string, help: opt(string), answerMode: enumeration('single', 'multiple', 'text', 'number', 'range', 'rank', 'confirm'), options: opt(array(option)), allowCustomAnswer: { type: 'boolean' }, allowUnknown: { type: 'boolean' }, allowDefer: { type: 'boolean' }, required: { type: 'boolean' }, targetItemTypes: array(enumeration('product_definition', 'problem', 'goal', 'user_role', 'scenario', 'scope', 'out_of_scope', 'requirement', 'constraint', 'technical_decision', 'success_metric', 'risk', 'open_issue')) });
const blockTypes = {
  assistant_text: object({ type: { const: 'assistant_text' }, content: string }),
  question,
  explanation: object({ type: { const: 'explanation' }, title: string, summary: string, comparisons: array(object({ label: string, description: string, bestWhen: opt(string) }, ['label', 'description'])), example: opt(string), returnToQuestionId: string }),
  recommendation: object({ type: { const: 'recommendation' }, questionId: string, recommendedValue: string, rationale: string, tradeoffs: strings, assumptions: strings }),
  proposal_summary: object({ type: { const: 'proposal_summary' }, proposalIds: strings }),
  conflict_notice: object({ type: { const: 'conflict_notice' }, proposalIds: strings }),
  readiness_notice: object({ type: { const: 'readiness_notice' }, readiness: object({ state: enumeration('insufficient', 'workable', 'ready'), areas: array(object({ key: string, status: enumeration('missing', 'deferred', 'not_applicable', 'confirmed', 'review_required'), itemIds: strings })), pendingProposalCount: { type: 'integer', minimum: 0 }, conflictCount: { type: 'integer', minimum: 0 } }) }),
  next_action: object({ type: { const: 'next_action' }, action: enumeration('continue_questions', 'generate_requirements', 'review_requirements', 'mark_requirements_ready', 'generate_prd', 'review_prd', 'download_document') }),
};
const union = choices => ({ oneOf: choices });
const recommendationCandidate = object({ title: string, rationale: string, tradeoffs: array(string, 4), assumptions: strings, evidence: array(evidence, 8), proposal: proposal });
const recommendationCandidates = { ...array(recommendationCandidate, 11), minItems: 11 };
const designItemTypes = enumeration('product_definition', 'problem', 'goal', 'user_role', 'scenario', 'scope', 'out_of_scope', 'requirement', 'constraint', 'technical_decision', 'success_metric', 'risk', 'open_issue');
const groundedEvidence = object({ sourceType: enumeration('message', 'file'), sourceId: string, excerpt: opt(string), location: opt(string) }, ['sourceType', 'sourceId']);
const recommendationCandidateV2 = object({
  title: string,
  rationale: string,
  tradeoffs: array(string, 2),
  assumptions: array(string, 2),
  evidence: array(groundedEvidence, 2),
  designItem: object({ type: designItemTypes, title: string, description: string }),
});
const followUpDraft = object({ componentType: enumeration('single_choice', 'multiple_choice', 'free_text', 'number', 'range', 'rank', 'confirm'), topic: string, prompt: string, help: opt(string), options: opt(array(option, 20)), required: { type: 'boolean' }, allowCustomAnswer: { type: 'boolean' }, allowUnknown: { type: 'boolean' }, allowDefer: { type: 'boolean' }, targetItemTypes: array(enumeration('product_definition', 'problem', 'goal', 'user_role', 'scenario', 'scope', 'out_of_scope', 'requirement', 'constraint', 'technical_decision', 'success_metric', 'risk', 'open_issue')) });
const optionRecommendV2 = object({ assistantMessage: string, recommendations: { type: 'array', items: recommendationCandidateV2, minItems: 0, maxItems: 11 }, followUp: opt(followUpDraft) });
const recommendationEvidenceV3 = object({ sourceType: enumeration('message', 'file'), sourceId: string });
const recommendationCandidateV3 = object({
  title: string,
  rationale: string,
  tradeoffs: array(string, 1),
  assumptions: array(string, 1),
  evidence: array(recommendationEvidenceV3, 1),
  designItem: object({ type: designItemTypes, description: string }),
});
const optionRecommendV3 = object({ assistantMessage: string, recommendations: { type: 'array', items: recommendationCandidateV3, minItems: 0, maxItems: 11 }, followUp: opt(followUpDraft) });
const recommendationCandidateV4 = object({
  t: string,
  r: string,
  x: array(string, 1),
  a: array(string, 1),
  e: object({ s: enumeration('message', 'file'), i: string }),
  k: designItemTypes,
  d: string,
});
const optionRecommendV4 = object({ m: string, r: { type: 'array', items: recommendationCandidateV4, minItems: 0, maxItems: 11 }, f: opt(followUpDraft) });
const recommendationCandidateV5 = object({
  t: boundedString(12),
  r: boundedString(20),
  x: array(boundedString(12), 1),
  a: array(boundedString(12), 1),
  e: object({ s: enumeration('message', 'file'), i: boundedString(36) }),
  k: designItemTypes,
  d: boundedString(20),
});
const recommendationFollowUpOptionV5 = object({ value: boundedString(40), label: boundedString(40), description: opt(boundedString(100)), recommended: opt({ type: 'boolean' }), recommendationReason: opt(boundedString(80)) }, ['value', 'label']);
const recommendationFollowUpV5 = object({
  componentType: enumeration('single_choice', 'multiple_choice', 'free_text', 'number', 'range', 'rank', 'confirm'),
  topic: boundedString(60),
  prompt: boundedString(160),
  help: opt(boundedString(120)),
  options: opt(array(recommendationFollowUpOptionV5, 6)),
  required: { type: 'boolean' },
  allowCustomAnswer: { type: 'boolean' },
  allowUnknown: { type: 'boolean' },
  allowDefer: { type: 'boolean' },
  targetItemTypes: array(designItemTypes, 13),
});
const optionRecommendV5 = object({ m: boundedString(24), r: { type: 'array', items: recommendationCandidateV5, minItems: 0, maxItems: 11 }, f: opt(recommendationFollowUpV5) });
const recommendationCandidateV6 = object({
  t: boundedString(8),
  r: boundedString(12),
  x: array(boundedString(8), 1),
  a: array(boundedString(8), 1),
  e: object({ s: enumeration('message', 'file'), i: boundedString(36) }),
  k: designItemTypes,
  d: boundedString(12),
});
const optionRecommendV6 = object({ m: boundedString(12), r: { type: 'array', items: recommendationCandidateV6, minItems: 0, maxItems: 11 }, f: opt(recommendationFollowUpV5) });
const optionRecommendV7 = object({ m: boundedString(12), r: { type: 'array', items: recommendationCandidateV6, minItems: 0, maxItems: 4 }, f: opt(recommendationFollowUpV5) });
const recommendationCandidatesBlock = object({ type: { const: 'recommendation_candidates' }, id: string, candidates: array(object({ id: string, title: string, rationale: string, tradeoffs: strings, assumptions: strings, evidence: array(evidence), proposalDraft: proposal }, ['id', 'title', 'rationale', 'tradeoffs', 'assumptions', 'evidence', 'proposalDraft']), 11) });
const displayBlock = union([...Object.values(blockTypes), recommendationCandidatesBlock]);
const composition = object({ type: { const: 'question' }, prompt: string, help: opt(string), options: opt(array(option)) }, ['type', 'prompt']);
const explanationPayload = object({ block: blockTypes.explanation });
const recommendationPayload = object({ block: blockTypes.recommendation, proposal });
const fact = object({ text: string, sourceMessageIds: strings });
const section = object({ key: string, title: string, markdown: { type: 'string' }, sourceItemIds: strings });
const requirementsDraft = object({ sections: array(section), requirements: array(object({ id: string, category: enumeration('functional', 'non_functional', 'data', 'integration', 'security', 'operation'), title: string, description: string, priority: enumeration('P0', 'P1', 'P2'), sourceItemIds: strings, acceptanceCriteria: array(object({ text: string, sourceItemIds: strings })), openIssueIds: strings })) });
const prdDraft = object({ sections: array(section), requirementLinks: array(object({ sectionKey: string, requirementIds: strings })), goals: array(object({ text: string, sourceItemIds: strings })), successMetrics: array(object({ text: string, sourceItemIds: strings })), risks: array(object({ text: string, mitigation: opt(string), sourceItemIds: strings }, ['text', 'sourceItemIds'])) });
const setupGuideDraft = object({ sections: array(object({ key:string, title:string, markdown:{type:'string'}, sourceItemIds:strings, sourceExcerptIds:strings })), openIssues:array(object({id:string,title:string,description:string,sourceItemIds:strings})) });
const review = object({ verdict: enumeration('pass', 'repairable', 'user_review_required'), issues: array(object({ code: string, severity: enumeration('error', 'warning'), sectionKey: string, relatedItemIds: strings, description: string, repairInstruction: opt(string) }, ['code', 'severity', 'sectionKey', 'relatedItemIds', 'description'])), coverage: array(object({ targetId: string, status: enumeration('covered', 'missing', 'conflict') })) });
const prdDimensionReview = object({ dimension: enumeration('problem','goals','users','scope','success_metrics'), verdict: enumeration('aligned','unsupported','misaligned','unknown'), sourceItemIds: strings, rationale: string, repairInstruction: opt(string) }, ['dimension','verdict','sourceItemIds','rationale']);
const prdReview = object({ verdict: enumeration('pass', 'repairable', 'user_review_required'), issues: array(object({ code: string, severity: enumeration('error', 'warning'), sectionKey: string, relatedItemIds: strings, description: string, repairInstruction: opt(string) }, ['code', 'severity', 'sectionKey', 'relatedItemIds', 'description'])), coverage: array(object({ targetId: string, status: enumeration('covered', 'missing', 'conflict') })), dimensionReviews: array(prdDimensionReview) });
const turnAnalyzeV2 = object({ blocks: array(blockTypes.assistant_text, 6), proposals: array(proposal, 8), answerInterpretation: object({ directAnswer: opt(string), additionalFacts: strings, ambiguities: strings }, ['additionalFacts', 'ambiguities']), suggestedFollowUp: opt(object({ purpose: enumeration('clarify_current_answer', 'continue_catalog'), reason: string })) });
const turnAnalyzeV4 = object({ assistantMessage: string, proposals: array(proposal, 8), answerInterpretation: object({ directAnswer: opt(string), additionalFacts: strings, ambiguities: strings }, ['additionalFacts', 'ambiguities']), followUp: opt(followUpDraft), recommendations: opt(recommendationCandidates) });
const turnAnalyzeV5 = object({ assistantMessage: string, proposals: array(proposal, 8), answerInterpretation: object({ directAnswer: opt(string), additionalFacts: strings, ambiguities: strings }, ['additionalFacts', 'ambiguities']), followUp: opt(followUpDraft) });
const turnEvidenceV6 = object({ s: enumeration('message', 'file'), i: boundedString(36) });
const turnProposalV6 = object({
  o: enumeration('create', 'update', 'delete'), t: enumeration('design_item', 'acceptance_criterion'),
  i: opt(boundedString(36)), b: opt(boundedString(180)), a: opt(boundedString(180)),
  r: boundedString(100), e: array(turnEvidenceV6, 2), x: array(boundedString(36), 4),
}, ['o', 't', 'r', 'e', 'x']);
const turnFollowUpOptionV6 = object({
  value: boundedString(40), label: boundedString(60), description: opt(boundedString(80)),
  recommended: opt({ type: 'boolean' }), recommendationReason: opt(boundedString(60)),
}, ['value', 'label']);
const turnFollowUpV6 = object({
  componentType: enumeration('single_choice', 'multiple_choice', 'free_text', 'number', 'range', 'rank', 'confirm'),
  topic: boundedString(60), prompt: boundedString(160), help: opt(boundedString(100)),
  options: opt(array(turnFollowUpOptionV6, 4)), required: { type: 'boolean' },
  allowCustomAnswer: { type: 'boolean' }, allowUnknown: { type: 'boolean' }, allowDefer: { type: 'boolean' },
  targetItemTypes: array(designItemTypes, 13),
});
const turnAnalyzeV6 = object({ m: boundedString(200), p: array(turnProposalV6, 8), f: opt(turnFollowUpV6) });
const turnAnalyzeV7 = object({ m: boundedString(200), p: array(turnProposalV6, 4), f: opt(turnFollowUpV6) });
const tasks = {
  QUESTION_COMPOSE: composition, QUESTION_EXPLAIN: explanationPayload, TURN_ANALYZE: turnAnalyzeV7, OPTION_RECOMMEND: optionRecommendV7,
  CONTEXT_COMPACT: object({ confirmedFacts: array(fact), explicitUnknowns: array(fact), rejectedDirections: array(fact), unresolvedQuestions: array(fact), sourceMessageIds: strings }),
  REQUIREMENTS_DRAFT: requirementsDraft, REQUIREMENTS_REVIEW: review, REQUIREMENTS_REPAIR: object({ sections: array(section), resolvedIssueIds: strings }), SETUP_GUIDE_DRAFT: setupGuideDraft,
  PRD_DRAFT: prdDraft, PRD_REVIEW: prdReview, PRD_REPAIR: object({ sections: array(section), resolvedIssueIds: strings }),
  DOCUMENT_PATCH: object({ proposals: array(proposal) }),
  CONSISTENCY_REVIEW: object({ findings: array(object({ type: string, location: string, sourceItemIds: strings, severity: enumeration('error', 'warning'), nextAction: string, proposal: opt(proposal) }, ['type', 'location', 'sourceItemIds', 'severity', 'nextAction'])) }),
};
const taskEnvelope = task => {
  const recommendationMetadata = task === 'OPTION_RECOMMEND';
  return object({
    task: { const: task }, promptVersion: string, schemaVersion: string,
    designRevision: { type: 'integer', minimum: 0 }, payload: tasks[task],
    referencedItemIds: recommendationMetadata || task === 'TURN_ANALYZE' ? array(string, 0) : strings,
    referencedSourceIds: recommendationMetadata || task === 'TURN_ANALYZE' ? array(string, 0) : strings,
    warnings: array(object({ code: string, severity: enumeration('info', 'warning'), message: string }, ['code', 'severity', 'message']), recommendationMetadata || task === 'TURN_ANALYZE' ? 0 : undefined),
  });
};
const turnAnalyzeV5Envelope = object({
  task: { const: 'TURN_ANALYZE' }, promptVersion: string, schemaVersion: { const: 'v5' },
  designRevision: { type: 'integer', minimum: 0 }, payload: turnAnalyzeV5,
  referencedItemIds: strings, referencedSourceIds: strings,
  warnings: array(object({ code: string, severity: enumeration('info', 'warning'), message: string }, ['code', 'severity', 'message'])),
});
const projectContext = object({ projectId: string, title: string, designRevision: { type: 'integer', minimum: 0 } });
const responseTo = object({ messageId: string, blockId: string, choiceId: opt(string), selectedValues: opt(strings), customText: opt({ type: 'string' }), numberValue: opt({ type: 'number' }), rangeValue: opt(object({ start: { type: 'number' }, end: { type: 'number' } })), rankedValues: opt(strings) }, ['messageId', 'blockId']);
const userTurn = object({ id: string, kind: enumeration('text', 'choice', 'recommendation_choice'), text: string, responseTo: opt(responseTo) }, ['id', 'kind', 'text']);
const contextMessage = object({ id: string, role: enumeration('user', 'assistant'), kind: enumeration('text', 'question'), content: { type: 'string' }, blocks: opt(array(displayBlock, 6)) });
const attributeMap = { type: 'object', additionalProperties: {} };
const designItemContext = object({ id: string, type: enumeration('product_definition', 'problem', 'goal', 'user_role', 'scenario', 'scope', 'out_of_scope', 'requirement', 'constraint', 'technical_decision', 'success_metric', 'risk', 'open_issue'), key: opt(string), title: string, description: { type: 'string' }, attributes: attributeMap });
const sourceExcerpt = object({ id: string, sourceId: string, text: { type: 'string' }, location: opt(string) }, ['id', 'sourceId', 'text']);
const turnRequest = object({ logicalRequestId: string, attemptId: string, generationJobId: opt(string), projectSummary: projectContext, userTurn, recentMessages: array(contextMessage), relevantDesignItems: array(designItemContext), sources: array(sourceExcerpt), requestLedgerEntries: opt(array({ type: 'object', additionalProperties: {} }, 10000)) });
const turnResponse = object({ assistantMessage: string, proposals: array(proposal), followUp: opt(question), recommendationCandidates: opt(recommendationCandidatesBlock), requestLedgerEntries: opt(array({ type: 'object', additionalProperties: {} }, 10000)), referencedItemIds: strings, referencedSourceIds: strings });
const documentsGenerateRequest = object({ documentType: enumeration('requirements', 'prd', 'setup_guide'), designRevision: { type: 'integer', minimum: 0 } });
const requirementsDesignItem = object({
  id: string, type: enumeration('product_definition', 'problem', 'goal', 'user_role', 'scenario', 'scope', 'out_of_scope', 'requirement', 'constraint', 'technical_decision', 'success_metric', 'risk', 'open_issue'),
  key: opt(string), title: string, description: { type: 'string' }, status: enumeration('proposed', 'confirmed', 'deferred', 'not_applicable', 'review_required', 'rejected'),
  priority: opt(enumeration('must', 'should', 'could', 'wont')), archivedAt: opt(string), attributes: opt(attributeMap),
  acceptanceCriteria: array(object({ id: string, text: string, status: enumeration('draft', 'confirmed', 'review_required') })),
});
const requirementsProposal = object({
  id: string, operation: enumeration('create', 'update', 'delete'), targetType: enumeration('design_item', 'acceptance_criterion', 'document_section'),
  targetId: opt(string), before: opt({}), after: opt({}), affectedItemIds: strings, status: enumeration('pending', 'accepted', 'edited_and_accepted', 'rejected', 'superseded'),
});
const requirementsGenerateRequest = object({
  documentType: { const: 'requirements' }, projectId: string, designRevision: { type: 'integer', minimum: 0 }, currentDesignRevision: { type: 'integer', minimum: 0 }, logicalRequestId: string, attemptId: string,
  project: object({ id: string, title: string, designRevision: { type: 'integer', minimum: 0 } }),
  designItems: array(requirementsDesignItem), proposals: array(requirementsProposal),
});
const setupGuideDesignItem = object({id:string,type:enumeration('technical_decision','constraint','requirement','risk','open_issue'),key:opt(string),title:string,description:{type:'string'},status:enumeration('proposed','confirmed','deferred','not_applicable','review_required','rejected'),archivedAt:opt(string),attributes:opt(attributeMap),evidence:array(object({sourceId:string,excerpt:opt(string),location:opt(string)},['sourceId']))});
const setupGuideGenerateRequest=object({documentType:{const:'setup_guide'},projectId:string,designRevision:{type:'integer',minimum:0},currentDesignRevision:{type:'integer',minimum:0},logicalRequestId:string,attemptId:string,project:object({id:string,title:string,designRevision:{type:'integer',minimum:0}}),designItems:array(setupGuideDesignItem),sources:array(object({id:string,extractionStatus:enumeration('queued','extracting','ready','unsupported','failed'),extractedText:opt({type:'string'}),archivedAt:opt(string)}))});
const prdRequirement = object({ id:string, category:enumeration('functional','non_functional','data','integration','security','operation'), title:string, description:string, priority:enumeration('P0','P1','P2'), sourceItemIds:strings, acceptanceCriteria:array(object({text:string,sourceItemIds:strings})), openIssueIds:strings });
const prdReadyDocument = object({ id:string, projectId:opt(string), type:{const:'requirements'}, title:string, status:enumeration('draft','review_required','ready'), designRevision:{type:'integer',minimum:0}, version:{type:'integer',minimum:1}, sectionIds:strings, requirements:array(prdRequirement), openIssues:array(object({id:string,title:string,description:string,sourceItemIds:strings})), reviewIssues:array(object({code:string,severity:enumeration('error','warning'),sectionKey:string,relatedItemIds:strings,description:string,repairInstruction:opt(string)},['code','severity','sectionKey','relatedItemIds','description'])), readyDesignRevision:opt({type:'integer',minimum:0}), createdAt:opt(string), generationArtifact:string, readyConfirmationArtifact:string });
const prdSection = object({ id:string, projectId:string, documentId:string, key:string, title:string, markdown:{type:'string'}, order:{type:'integer',minimum:0}, sourceItemIds:strings, origin:enumeration('generated','user_edited','accepted_proposal'), syncStatus:enumeration('current','stale','conflict'), updatedAt:string });
const generationJobSnapshot = object({ id:string, type:{const:'PRD_DRAFT'}, logicalRequestId:string, status:enumeration('queued','running','succeeded','failed','cancelled') });
const prdGenerateRequest = object({
  documentType:{const:'prd'}, projectId:string, designRevision:{type:'integer',minimum:0}, currentDesignRevision:{type:'integer',minimum:0}, logicalRequestId:string, attemptId:string,
  project:object({id:string,title:string,designRevision:{type:'integer',minimum:0}}),
  designItems:array(requirementsDesignItem), documents:array(prdReadyDocument), sections:array(prdSection), generationJobs:array(generationJobSnapshot),
});
const requirementsReadyRequest = object({ confirmed:{type:'boolean'}, projectId:string, designRevision:{type:'integer',minimum:0}, document:{type:'object',additionalProperties:{}}, sections:array({type:'object',additionalProperties:{}}), generationArtifact:string });
const documentsPatchRequest = union([
  object({ documentId: string, targetSectionIds: array(string), instruction: opt(string) }, ['documentId', 'targetSectionIds']),
  object({ documentId: string, targetRequirementIds: array(string), instruction: opt(string) }, ['documentId', 'targetRequirementIds']),
]);
const reviewRequest = object({ requirementsDocumentId: string, prdDocumentId: string });
const reviewResponse = array(object({ type: string, location: string, sourceItemIds: strings, proposal: opt(proposal) }, ['type', 'location', 'sourceItemIds']));
const envelope = union([taskEnvelope('REQUIREMENTS_DRAFT'), taskEnvelope('PRD_DRAFT')]);
const setupGuideReadyRequest=object({confirmed:{type:'boolean'},projectId:string,designRevision:{type:'integer',minimum:0},document:{type:'object',additionalProperties:{}},sections:array({type:'object',additionalProperties:{}}),generationArtifact:string});
export const schemas = Object.freeze({
  displayBlock, normalizedBlocks: array(displayBlock, 6),
  tasks: Object.freeze(tasks), envelopes: Object.freeze({ ...Object.fromEntries(Object.keys(tasks).map(task => [task, taskEnvelope(task)])), TURN_ANALYZE_V5: turnAnalyzeV5Envelope }),
  turnAnalyzeV2, turnAnalyzeV4, turnAnalyzeV5, turnAnalyzeV6, turnAnalyzeV7, optionRecommendV1: recommendationPayload, optionRecommendV2, optionRecommendV3, optionRecommendV4, optionRecommendV5, optionRecommendV6, optionRecommendV7,
  http: Object.freeze({ turnRequest, turnResponse, documentsGenerateRequest, requirementsGenerateRequest, prdGenerateRequest, setupGuideGenerateRequest, setupGuideReadyRequest, requirementsReadyRequest, documentsGenerateResponse: envelope, documentsPatchRequest, documentsPatchResponse: array(proposal), reviewRequest, reviewResponse }),
});
export function validateSchema(schema, value) {
  const errors = [];
  const visit = (node, current, path) => {
    if (!node || Object.keys(node).length === 0) return;
    if (node.oneOf) {
      const matches = node.oneOf.filter(choice => validateSchema(choice, current).valid).length;
      if (matches !== 1) errors.push(`${path}: expected exactly one schema`);
      return;
    }
    if (node.type === 'object') {
      if (!current || typeof current !== 'object' || Array.isArray(current)) { errors.push(`${path}: expected object`); return; }
      for (const key of node.required ?? []) if (!Object.hasOwn(current, key)) errors.push(`${path}.${key}: required`);
      for (const [key, value] of Object.entries(current)) {
        if (!Object.hasOwn(node.properties ?? {}, key)) { if (node.additionalProperties === false) errors.push(`${path}.${key}: additional property`); else if (node.additionalProperties && typeof node.additionalProperties === 'object') visit(node.additionalProperties,value,`${path}.${key}`); }
        else visit(node.properties[key], value, `${path}.${key}`);
      }
    } else if (node.type === 'array') {
      if (!Array.isArray(current)) { errors.push(`${path}: expected array`); return; }
      if (node.maxItems !== undefined && current.length > node.maxItems) errors.push(`${path}: maxItems ${node.maxItems}`);
      if (node.minItems !== undefined && current.length < node.minItems) errors.push(`${path}: minItems ${node.minItems}`);
      current.forEach((value, index) => visit(node.items, value, `${path}[${index}]`));
    } else if (node.type === 'string') {
      if (typeof current !== 'string') errors.push(`${path}: expected string`);
      else if (current.length < (node.minLength ?? 0)) errors.push(`${path}: minLength ${node.minLength}`);
      else if (node.pattern && !new RegExp(node.pattern, 'u').test(current)) errors.push(`${path}: pattern mismatch`);
    } else if (node.type === 'number') {
      if (typeof current !== 'number' || !Number.isFinite(current)) errors.push(`${path}: expected number`);
    } else if (node.type === 'integer') {
      if (!Number.isInteger(current)) errors.push(`${path}: expected integer`);
      else if (node.minimum !== undefined && current < node.minimum) errors.push(`${path}: minimum ${node.minimum}`);
    } else if (node.type === 'boolean' && typeof current !== 'boolean') errors.push(`${path}: expected boolean`);
    if (node.enum && !node.enum.includes(current)) errors.push(`${path}: invalid enum`);
    if (Object.hasOwn(node, 'const') && current !== node.const) errors.push(`${path}: expected ${node.const}`);
  };
  visit(schema, value, '$');
  return { valid: errors.length === 0, errors };
}
