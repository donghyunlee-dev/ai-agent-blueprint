import test from 'node:test';
import assert from 'node:assert/strict';
import { previewDocumentImpact } from '../../src/features/documents/document-impact-preview.js';

const aggregate = {
  documents: [
    { id:'requirements-1', requirements:[{ id:'R1', sourceItemIds:['design-1'] }] },
    { id:'prd-1', requirements:[] },
  ],
  sections: [
    { id:'req-section', documentId:'requirements-1', sourceItemIds:['design-1'] },
    { id:'prd-section', documentId:'prd-1', sourceItemIds:['design-1','design-2'] },
  ],
};

test('Requirements selected requirement preview lists linked design and both impacted document IDs', () => {
  assert.deepEqual(previewDocumentImpact(aggregate,'requirements-1',{sectionIds:[],requirementIds:['R1']}),{targetIds:['R1'],itemIds:['design-1'],documentIds:['prd-1','requirements-1']});
});

test('PRD selected section preview lists selected target and its known cross-document impacts', () => {
  assert.deepEqual(previewDocumentImpact(aggregate,'prd-1',{sectionIds:['prd-section'],requirementIds:[]}),{targetIds:['prd-section'],itemIds:['design-1','design-2'],documentIds:['prd-1','requirements-1']});
});
