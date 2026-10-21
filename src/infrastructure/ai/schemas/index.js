const opt = value => ({ ...value, optional: true });
const string = { type: 'string', minLength: 1 };
const strings = { type: 'array', items: string };
const enumeration = (...values) => ({ type: 'string', enum: values });
const object = (props, required = Object.keys(props).filter(key => props[key]?.optional !== true)) => ({
  type: 'object', properties: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'optional'))])), required, additionalProperties: false,
});
const array = (items, maxItems) => ({ type: 'array', items, ...(maxItems === undefined ? {} : { maxItems }) });
const evidence = object({ sourceType: enumeration('message', 'file', 'user_edit', 'agent_inference'), sourceId: string, excerpt: opt(string), location: opt(string) }, ['sourceType', 'sourceId']);
const proposal = object({ operation: enumeration('create', 'update', 'delete'), targetType: enumeration('design_item', 'acceptance_criterion', 'document_section'), targetId: opt(string), before: opt({}), after: opt({}), rationale: string, evidence: array(evidence), affectedItemIds: strings });
const option = object({ value: string, label: string, description: opt(string), recommended: opt({ type: 'boolean' }), recommendationReason: opt(string) }, ['value', 'label']);
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
const displayBlock = union(Object.values(blockTypes));
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
const turnAnalyze = object({ blocks: array(blockTypes.assistant_text, 6), proposals: array(proposal, 8), answerInterpretation: object({ directAnswer: opt(string), additionalFacts: strings, ambiguities: strings }, ['additionalFacts', 'ambiguities']), suggestedFollowUp: opt(object({ purpose: enumeration('clarify_current_answer', 'continue_catalog'), reason: string })) });
const tasks = {
  QUESTION_COMPOSE: composition, QUESTION_EXPLAIN: explanationPayload, TURN_ANALYZE: turnAnalyze, OPTION_RECOMMEND: recommendationPayload,
  CONTEXT_COMPACT: object({ confirmedFacts: array(fact), explicitUnknowns: array(fact), rejectedDirections: array(fact), unresolvedQuestions: array(fact), sourceMessageIds: strings }),
  REQUIREMENTS_DRAFT: requirementsDraft, REQUIREMENTS_REVIEW: review, REQUIREMENTS_REPAIR: object({ sections: array(section), resolvedIssueIds: strings }), SETUP_GUIDE_DRAFT: setupGuideDraft,
  PRD_DRAFT: prdDraft, PRD_REVIEW: prdReview, PRD_REPAIR: object({ sections: array(section), resolvedIssueIds: strings }),
  DOCUMENT_PATCH: object({ proposals: array(proposal) }),
  CONSISTENCY_REVIEW: object({ findings: array(object({ type: string, location: string, sourceItemIds: strings, severity: enumeration('error', 'warning'), nextAction: string, proposal: opt(proposal) }, ['type', 'location', 'sourceItemIds', 'severity', 'nextAction'])) }),
};
const taskEnvelope = task => object({ task: { const: task }, promptVersion: string, schemaVersion: string, designRevision: { type: 'integer', minimum: 0 }, payload: tasks[task], referencedItemIds: strings, referencedSourceIds: strings, warnings: array(object({ code: string, severity: enumeration('info', 'warning'), message: string }, ['code', 'severity', 'message'])) });
const projectContext = object({ projectId: string, title: string, designRevision: { type: 'integer', minimum: 0 } });
const userAnswer = object({ questionId: string, answerMode: enumeration('single', 'multiple', 'text', 'number', 'range', 'rank', 'confirm'), action: enumeration('answer', 'unknown', 'recommend', 'defer', 'skip'), selectedValues: opt(strings), customText: opt({ type: 'string' }), numberValue: opt({ type: 'number' }), rangeValue: opt(object({ start: { type: 'number' }, end: { type: 'number' } })), rankedValues: opt(strings) }, ['questionId', 'answerMode', 'action']);
const contextMessage = object({ id: string, role: enumeration('user', 'assistant'), kind: enumeration('text', 'question'), content: { type: 'string' } });
const attributeMap = { type: 'object', additionalProperties: {} };
const designItemContext = object({ id: string, type: enumeration('product_definition', 'problem', 'goal', 'user_role', 'scenario', 'scope', 'out_of_scope', 'requirement', 'constraint', 'technical_decision', 'success_metric', 'risk', 'open_issue'), key: opt(string), title: string, description: { type: 'string' }, attributes: attributeMap });
const sourceExcerpt = object({ id: string, sourceId: string, text: { type: 'string' }, location: opt(string) }, ['id', 'sourceId', 'text']);
const turnRequest = object({ logicalRequestId: string, attemptId: string, projectSummary: projectContext, question: opt(question), answer: userAnswer, recentMessages: array(contextMessage), relevantDesignItems: array(designItemContext), sources: array(sourceExcerpt) });
const turnResponse = object({ assistantMessage: { type: 'string' }, proposals: array(proposal), questionDraft: opt(composition), referencedItemIds: strings, referencedSourceIds: strings });
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
  tasks: Object.freeze(tasks), envelopes: Object.freeze(Object.fromEntries(Object.keys(tasks).map(task => [task, taskEnvelope(task)]))),
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
