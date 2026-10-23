import { useEffect, useRef, useState } from "react";
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
  const [redirectToastVisible, setRedirectToastVisible] = useState(false);
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

  useEffect(() => {
    if (!redirectToastVisible) return;
    const timeout = window.setTimeout(() => setRedirectToastVisible(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [redirectToastVisible]);

  const message = queryMode === "expired"
    ? "로그인 세션이 만료되었습니다. 다시 로그인해 주세요."
    : queryMode === "error"
      ? "로그인을 완료하지 못했습니다. 다시 시도해 주세요."
      : null;

  return (
    <main className="auth-page">
      <div className="auth-photo" aria-hidden="true" />
      <section className="auth-login-panel" aria-labelledby="auth-title">
        <img className="auth-windsoft-mark" src="/login-reference/windsoft.png" alt="Windsoft" />
        {queryMode === "checking" ? (
          <p className="auth-state-message" role="status" aria-live="polite">로그인 상태를 확인하고 있습니다.</p>
        ) : (
          <div className="auth-login-content">
            <h1 id="auth-title" className="auth-ideon-heading">
              <img src="/login-reference/ideon.png" alt="ideon" />
            </h1>
            {message ? <p className="auth-alert" role="alert" tabIndex={-1} ref={alertRef}>{message}</p> : null}
            <button className="auth-google-button" type="button" ref={buttonRef} disabled={busy} aria-busy={busy} onClick={() => { setRedirectToastVisible(true); startLogin(returnTo); }}>
              <img className="auth-google-mark" src="/login-reference/google.png" alt="" />
              <span className="auth-google-label">Google로 시작하기</span>
              <img className="auth-google-chevron" src="/login-reference/chevron.png" alt="" />
            </button>
          </div>
        )}
      </section>
      {redirectToastVisible ? <p className="auth-redirect-toast" role="status" aria-live="polite">Google 로그인 화면으로 이동하고 있습니다.</p> : null}
    </main>
  );
}
