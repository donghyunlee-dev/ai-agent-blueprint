import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestionComposition, validateRecommendation } from '../../src/infrastructure/ai/display-block.js';

test('AI question copy preserves catalog ID, topic, form contract, and stable option values', () => {
 const candidate={id:'q1',topic:'goal',prompt:'Old',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:false,targetItemTypes:['goal'],options:[{value:'a',label:'A'},{value:'b',label:'B'}]};
 assert.equal(validateQuestionComposition({type:'question',prompt:'새 질문',options:[{value:'a',label:'첫째'},{value:'b',label:'둘째'}]},candidate).valid,true);
 assert.equal(validateQuestionComposition({type:'question',prompt:'새 질문',options:[{value:'other',label:'다른 선택'}]},candidate).valid,false);
 assert.equal(validateQuestionComposition({type:'question',prompt:'질문',id:'q2'},candidate).valid,false);
});
test('recommendations stay within allowed option values and never mutate the selected option', () => {
 assert.equal(validateRecommendation({type:'recommendation',questionId:'q1',recommendedValue:'a',rationale:'이유',tradeoffs:['비용'],assumptions:[]},{id:'q1',options:[{value:'a'},{value:'b'}]}).valid,true);
 assert.equal(validateRecommendation({type:'recommendation',questionId:'q1',recommendedValue:'x',rationale:'이유',tradeoffs:['비용'],assumptions:[]},{id:'q1',options:[{value:'a'}]}).valid,false);
});

test('question composition can recommend at most one option and supplies its reason', async () => {
 const {validateQuestionComposition}=await import('../../src/infrastructure/ai/display-block.js');
 const candidate={id:'q1',topic:'goal',prompt:'?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:false,allowDefer:false,targetItemTypes:['goal'],options:[{value:'a',label:'A'},{value:'b',label:'B'}]};
 assert.equal(validateQuestionComposition({type:'question',prompt:'질문',options:[{value:'a',label:'A',recommended:true,recommendationReason:'현재 목표와 맞습니다.'},{value:'b',label:'B'}]},candidate).valid,true);
 assert.equal(validateQuestionComposition({type:'question',prompt:'질문',options:[{value:'a',label:'A',recommended:true},{value:'b',label:'B',recommended:true}]},candidate).valid,false);
 assert.equal(validateQuestionComposition({type:'question',prompt:'질문',options:[{value:'a',label:'A',recommended:true},{value:'b',label:'B'}]},candidate).valid,false);
});
