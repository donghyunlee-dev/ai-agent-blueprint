import { useState } from 'react';
import type { FormEvent } from 'react';
import type { QuestionSpec } from '../../domain/blueprint/types.js';

export type ContextualResponse = { kind:'text'|'choice'|'recommendation_choice'; text:string; responseTo?:{messageId:string;blockId:string;selectedValues?:string[];choiceId?:string;rankedValues?:string[];customText?:string;numberValue?:number;rangeValue?:{start:number;end:number}} };

export function ContextualQuestionCard({ question, messageId, onSubmit }: { question:QuestionSpec; messageId:string; onSubmit:(response:ContextualResponse)=>void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [numberValue,setNumberValue]=useState('');
  const [range,setRange]=useState({start:'',end:''});
  const [custom,setCustom]=useState('');
  const hasOptions = ['single','multiple','confirm','rank'].includes(question.answerMode) && Boolean(question.options?.length);
  const showRoleIcons = question.targetItemTypes.includes('user_role');
  const roleIconVariants = ['employee', 'admin', 'team', 'visitor'] as const;
  const canSubmit = question.answerMode === 'number' ? Boolean(numberValue) && Number.isFinite(Number(numberValue))
    : question.answerMode === 'range' ? Boolean(range.start) && Boolean(range.end) && Number(range.start) <= Number(range.end)
      : hasOptions ? selected.length > 0 : Boolean(text.trim());
  const select = (value:string, checked:boolean) => setSelected((current) => ['multiple','rank'].includes(question.answerMode)
    ? checked ? [...current,value] : current.filter((item)=>item!==value)
    : checked ? [value] : []);
  const submitText = (answer:string, value?:{numberValue:number}|{rangeValue:{start:number;end:number}}) => onSubmit({kind:'text',text:answer,responseTo:{messageId,blockId:question.id,...(value??{customText:answer})}});
  const submit = () => {
    if (question.answerMode === 'number') {
      const value=Number(numberValue);
      if(!numberValue || !Number.isFinite(value)) return;
      submitText(String(value),{numberValue:value});
      return;
    }
    if (question.answerMode === 'range') {
      const start=Number(range.start),end=Number(range.end);
      if(!range.start || !range.end || !Number.isFinite(start) || !Number.isFinite(end) || start>end) return;
      submitText(`${start}–${end}`,{rangeValue:{start,end}});
      return;
    }
    if (hasOptions) {
      const labels = selected.map((value)=>question.options?.find((option)=>option.value===value)?.label ?? value);
      if (!labels.length) return;
      const answer=[...labels,...(custom.trim() ? [`직접 입력: ${custom.trim()}`] : [])].join(', ');
      if(question.answerMode==='rank') {
        onSubmit({kind:'choice',text:answer,responseTo:{messageId,blockId:question.id,selectedValues:selected,rankedValues:selected}});
        return;
      }
      onSubmit({kind:'choice',text:answer,responseTo:{messageId,blockId:question.id,selectedValues:selected}});
      return;
    }
    const answer = text.trim();
    if (answer) submitText(answer);
  };
  const submitForm = (event:FormEvent<HTMLFormElement>) => { event.preventDefault(); submit(); };
  return <section className="question-card contextual-question-card" data-answer-mode={question.answerMode} aria-labelledby={`contextual-question-${question.id}`}>
    <div className="question-card-meta"><span>{question.topic}</span><span>{question.required ? '필수' : '선택'}</span></div>
    <h2 id={`contextual-question-${question.id}`}>{question.prompt}</h2>
    {question.help ? <p className="question-card-help">{question.help}</p> : null}
    <form onSubmit={submitForm} noValidate>
    {hasOptions ? <fieldset className="question-card-options"><legend>{question.answerMode === 'multiple' ? '해당하는 항목을 모두 선택하세요' : question.answerMode === 'rank' ? '순서를 정할 항목을 선택하세요' : '항목을 선택하세요'}</legend>
      {question.options?.map((option, index)=><label className="question-card-option" key={option.value}>
        {showRoleIcons ? <span className={`contextual-option-icon is-${roleIconVariants[index % roleIconVariants.length]}`} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{index % roleIconVariants.length === 0 ? <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> : index % roleIconVariants.length === 2 ? <><path d="M12 7v5m0 0H6v3m6-3h6v3" /><circle cx="12" cy="5" r="2" /><rect x="4" y="15" width="4" height="4" rx="1" /><rect x="16" y="15" width="4" height="4" rx="1" /></> : <><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1a7 7 0 0 1 14 0v1" /></>}</svg></span> : null}
        <input className={showRoleIcons ? 'has-contextual-icon' : undefined} type={['multiple','rank'].includes(question.answerMode) ? 'checkbox' : 'radio'} name={`contextual-${question.id}`} checked={selected.includes(option.value)} onChange={(event)=>select(option.value,event.target.checked)} />
        <span className="question-option-copy"><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
      </label>)}
    </fieldset> : question.answerMode==='number' ? <label className="question-card-field">숫자<input type="number" step="any" value={numberValue} onChange={(event)=>setNumberValue(event.target.value)} /></label> : question.answerMode==='range' ? <fieldset className="question-card-range"><legend>범위</legend><label>시작<input type="number" step="any" value={range.start} onChange={(event)=>setRange((current)=>({...current,start:event.target.value}))}/></label><label>끝<input type="number" step="any" value={range.end} onChange={(event)=>setRange((current)=>({...current,end:event.target.value}))}/></label></fieldset> : <label className="question-card-field">답변<textarea rows={3} value={text} onChange={(event)=>setText(event.target.value)} placeholder="답변을 입력하세요" /></label>}
    {hasOptions && question.allowCustomAnswer ? <label className="question-card-field">직접 입력 (선택)<input value={custom} onChange={(event)=>setCustom(event.target.value)} /></label> : null}
    {question.answerMode==='rank' && selected.length ? <ol className="question-card-rank-list">{selected.map((value,index)=><li key={value}><span>{question.options?.find((option)=>option.value===value)?.label ?? value}</span><button type="button" disabled={index===0} aria-label={`${value} 순위 위로`} onClick={()=>setSelected((current)=>{const next=[...current];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>위로</button><button type="button" disabled={index===selected.length-1} aria-label={`${value} 순위 아래로`} onClick={()=>setSelected((current)=>{const next=[...current];[next[index+1],next[index]]=[next[index],next[index+1]];return next;})}>아래로</button></li>)}</ol> : null}
    <div className="question-card-actions">{(!showRoleIcons || canSubmit) ? <button className="question-card-submit" type="submit" disabled={!canSubmit}>답변 제출</button> : null}{question.allowUnknown ? <button type="button" onClick={()=>submitText('이 항목은 아직 모르겠습니다.')}><span className="question-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="11" r="8" /><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.2 1-1.9 1.3-1.9 3m0 3h.01" /></svg></span>잘 모르겠어요</button> : null}<button type="button" onClick={()=>submitText('추천해 주세요.')}><span className="question-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m12 2 2.1 7.1L21 12l-6.9 2.9L12 22l-2.1-7.1L3 12l6.9-2.9L12 2Z" /></svg></span>추천해 주세요</button>{question.allowDefer ? <button type="button" onClick={()=>submitText('이 항목은 나중에 결정하겠습니다.')}><span className="question-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>나중에 결정</button> : null}</div>
    </form>
  </section>;
}
