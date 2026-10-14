import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AI_CONSENT_VERSION, hasCurrentProjectAiConsent } from '../../features/conversation/ai-consent.js';

export function AiConsentGate<T>({ consent, persistConsent, send, children }: { consent?: {acceptedAt:string;consentVersion:string} | null; persistConsent: (value:{acceptedAt:string;consentVersion:string}) => Promise<{acceptedAt:string;consentVersion:string}>; send: () => Promise<T>; children: (state:{run:()=>Promise<void>;busy:boolean;error:string|null}) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog=dialogRef.current; if(open && dialog && !dialog.open) dialog.showModal(); else if(!open && dialog?.open) dialog.close(); }, [open]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [pending, setPending] = useState<(()=>Promise<T>)|null>(null);
  async function run() {
    setError(null);
    if (hasCurrentProjectAiConsent(consent)) { setBusy(true); try { await send(); } catch { setError('요청을 보내지 못했습니다. 입력은 유지됩니다.'); } finally { setBusy(false); } return; }
    setPending(() => send);
    setOpen(true);
  }
  async function accept() {
    setBusy(true); setError(null);
    try {
      const saved = await persistConsent({ acceptedAt: new Date().toISOString(), consentVersion: AI_CONSENT_VERSION });
      if (!hasCurrentProjectAiConsent(saved)) throw new Error('CONSENT_SAVE_INVALID');
      setOpen(false);
      await pending?.();
      setPending(null);
    } catch { setError('동의 내용을 저장하지 못해 요청을 보내지 않았습니다. 입력은 유지됩니다.'); }
    finally { setBusy(false); }
  }
  return <>
    {children({run,busy,error})}
    {open ? <dialog ref={dialogRef} aria-labelledby="ai-consent-title" className="ai-consent-dialog" onCancel={(event) => { event.preventDefault(); setOpen(false); setPending(null); }}><h2 id="ai-consent-title">AI 사용 및 데이터 안내</h2><p>요청을 처리하기 위해 입력한 내용과 이 프로젝트의 관련 대화 맥락이 외부 AI 제공자에게 전달되어 처리됩니다. 민감한 정보는 입력하지 않는 것을 권장합니다.</p><p>요청 재시도를 위한 임시 멱등성 메타데이터와 schema 검증을 통과한 응답은 최대 24시간 서버 임시 저장소에 남을 수 있습니다. 원문 요청·대화 맥락과 인증 정보는 이 임시 요청 기록에 저장하지 않습니다.</p><p>동의를 취소하면 입력 초안은 유지되고 요청은 전송되지 않습니다.</p>{error ? <p role="alert">{error}</p> : null}<button type="button" disabled={busy} onClick={() => { setOpen(false); setPending(null); }}>취소</button><button type="button" disabled={busy} onClick={() => void accept()}>동의하고 계속</button></dialog> : null}
  </>;
}
