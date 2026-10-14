import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, safeReturnTo } from "../features/auth/AuthProvider";
import "../styles/auth.css";

type LoginMode = "login" | "checking" | "expired" | "error";

export function LoginPage({ mode = "login", returnTo: routeReturnTo }: { mode?: LoginMode; returnTo?: string }) {
  const { status, user, startLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnTo(routeReturnTo || params.get("returnTo"));
  const queryMode: LoginMode = params.has("sessionExpired") ? "expired" : params.has("error") ? "error" : status === "checking" ? "checking" : mode;
  const busy = status === "redirecting";

  useEffect(() => {
    if (status === "authenticated" && user) navigate(returnTo, { replace: true });
  }, [status, user, navigate, returnTo]);

  useEffect(() => {
    if (queryMode === "error" || queryMode === "expired") alertRef.current?.focus();
    else if (queryMode === "login") buttonRef.current?.focus();
  }, [queryMode]);

  const message = queryMode === "expired"
    ? "로그인 세션이 만료되었습니다. 다시 로그인해 주세요."
    : queryMode === "error"
      ? "로그인을 완료하지 못했습니다. 다시 시도해 주세요."
      : null;

  return (
    <main className="auth-page">
      <header className="auth-topbar"><span className="auth-brand-mark" aria-hidden="true">W</span><span>Windsoft Blueprint</span></header>
      <section className="auth-card" aria-labelledby="auth-title">
        {queryMode === "checking" ? (
          <p className="auth-checking" role="status" aria-live="polite">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          <>
            <span className="auth-eyebrow">WINSOFT · PRODUCT BLUEPRINT</span>
            <h1 id="auth-title">Agent Blueprint</h1>
            <p className="auth-lede">아이디어를 검토 가능한 제품 계획으로 구체화하세요.</p>
            <p className="auth-description">Google 계정으로 로그인하세요.</p>
            {message ? <p className="auth-alert" role="alert" tabIndex={-1} ref={alertRef}>{message}</p> : null}
            <button className="auth-google-button" type="button" ref={buttonRef} disabled={busy} aria-busy={busy} onClick={() => startLogin(returnTo)}>
              <GoogleMark />
              {busy ? "Google 로그인 화면으로 이동하고 있습니다." : "Google로 계속"}
            </button>
            <p className="auth-caption">프로젝트는 이 브라우저에 저장됩니다.</p>
          </>
        )}
      </section>
      <footer className="auth-footer" aria-label="개인정보 보호 및 고객 지원"><span>개인정보 보호</span><span aria-hidden="true">·</span><span>고객 지원</span></footer>
    </main>
  );
}

function GoogleMark() {
  return <svg className="auth-google-mark" aria-hidden="true" viewBox="0 0 20 20"><path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.82h5.39a4.61 4.61 0 0 1-2 3.03v2.48h3.24c1.9-1.75 2.97-4.33 2.97-7.31Z"/><path fill="#34A853" d="M10 20c2.7 0 4.97-.9 6.63-2.46l-3.24-2.48c-.9.61-2.05.97-3.39.97-2.61 0-4.82-1.76-5.61-4.13H1.05v2.55A10 10 0 0 0 10 20Z"/><path fill="#FBBC05" d="M4.39 11.9a6.02 6.02 0 0 1 0-3.8V5.55H1.05a10 10 0 0 0 0 8.9l3.34-2.55Z"/><path fill="#EA4335" d="M10 3.97c1.47 0 2.78.5 3.82 1.5l2.86-2.86A9.56 9.56 0 0 0 10 0a10 10 0 0 0-8.95 5.55L4.39 8.1C5.18 5.73 7.39 3.97 10 3.97Z"/></svg>;
}
