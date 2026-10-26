import { useState } from 'react';
import type { QuestionSpec } from '../../domain/blueprint/types.js';

export type ContextualResponse = { kind:'text'|'choice'|'recommendation_choice'; text:string; responseTo?:{messageId:string;blockId:string;selectedValues:string[];choiceId?:string;rankedValues?:string[]} };

export function ContextualQuestionCard({ question, messageId, onSubmit }: { question:QuestionSpec; messageId:string; onSubmit:(response:ContextualResponse)=>void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [numberValue,setNumberValue]=useState('');
  const [range,setRange]=useState({start:'',end:''});
  const [custom,setCustom]=useState('');
  const hasOptions = ['single','multiple','confirm','rank'].includes(question.answerMode) && Boolean(question.options?.length);
  const select = (value:string, checked:boolean) => setSelected((current) => ['multiple','rank'].includes(question.answerMode)
    ? checked ? [...current,value] : current.filter((item)=>item!==value)
    : checked ? [value] : []);
  const submit = () => {
    if (question.answerMode === 'number') {
      const value=Number(numberValue);
      if(!numberValue || !Number.isFinite(value)) return;
      onSubmit({kind:'text',text:String(value)});
      return;
    }
    if (question.answerMode === 'range') {
      const start=Number(range.start),end=Number(range.end);
      if(!range.start || !range.end || !Number.isFinite(start) || !Number.isFinite(end) || start>end) return;
      onSubmit({kind:'text',text:`${start}–${end}`});
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
    if (answer) onSubmit({kind:'text',text:answer});
  };
  return <section className="question-card contextual-question-card" aria-labelledby={`contextual-question-${question.id}`}>
    <div className="question-card-meta"><span>{question.topic}</span><span>{question.required ? '필수' : '선택'}</span></div>
    <h2 id={`contextual-question-${question.id}`}>{question.prompt}</h2>
    {question.help ? <p className="question-card-help">{question.help}</p> : null}
    {hasOptions ? <fieldset className="question-card-options"><legend>{question.answerMode === 'multiple' ? '해당하는 항목을 모두 선택하세요' : question.answerMode === 'rank' ? '순서를 정할 항목을 선택하세요' : '항목을 선택하세요'}</legend>
      {question.options?.map((option)=><label className="question-card-option" key={option.value}>
        <input type={['multiple','rank'].includes(question.answerMode) ? 'checkbox' : 'radio'} name={`contextual-${question.id}`} checked={selected.includes(option.value)} onChange={(event)=>select(option.value,event.target.checked)} />
        <span className="question-option-copy"><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
      </label>)}
    </fieldset> : question.answerMode==='number' ? <label className="question-card-field">숫자<input type="number" step="any" value={numberValue} onChange={(event)=>setNumberValue(event.target.value)} /></label> : question.answerMode==='range' ? <fieldset className="question-card-range"><legend>범위</legend><label>시작<input type="number" step="any" value={range.start} onChange={(event)=>setRange((current)=>({...current,start:event.target.value}))}/></label><label>끝<input type="number" step="any" value={range.end} onChange={(event)=>setRange((current)=>({...current,end:event.target.value}))}/></label></fieldset> : <label className="question-card-field">답변<textarea rows={3} value={text} onChange={(event)=>setText(event.target.value)} placeholder="답변을 입력하세요" /></label>}
    {hasOptions && question.allowCustomAnswer ? <label className="question-card-field">직접 입력 (선택)<input value={custom} onChange={(event)=>setCustom(event.target.value)} /></label> : null}
    {question.answerMode==='rank' && selected.length ? <ol className="question-card-rank-list">{selected.map((value,index)=><li key={value}><span>{question.options?.find((option)=>option.value===value)?.label ?? value}</span><button type="button" disabled={index===0} aria-label={`${value} 순위 위로`} onClick={()=>setSelected((current)=>{const next=[...current];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>위로</button><button type="button" disabled={index===selected.length-1} aria-label={`${value} 순위 아래로`} onClick={()=>setSelected((current)=>{const next=[...current];[next[index+1],next[index]]=[next[index],next[index+1]];return next;})}>아래로</button></li>)}</ol> : null}
    <div className="question-card-actions"><button className="question-card-submit" type="button" disabled={question.answerMode==='number' ? !numberValue || !Number.isFinite(Number(numberValue)) : question.answerMode==='range' ? !range.start || !range.end || Number(range.start)>Number(range.end) : hasOptions ? selected.length===0 : !text.trim()} onClick={submit}>답변 제출</button>{question.allowUnknown ? <button type="button" onClick={()=>onSubmit({kind:'text',text:'이 항목은 아직 모르겠습니다.'})}>잘 모르겠어요</button> : null}{question.allowDefer ? <button type="button" onClick={()=>onSubmit({kind:'text',text:'이 항목은 나중에 결정하겠습니다.'})}>나중에 결정</button> : null}</div>
  </section>;
}
