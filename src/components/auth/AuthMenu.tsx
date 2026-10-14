import { useRef, useState } from "react";
import { useAuth } from "../../features/auth/AuthProvider";

export function AuthMenu() {
  const { user, status, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const logoutAttempt = useRef(false);
  if (status !== "authenticated" || !user) return null;

  async function handleLogout() {
    if (logoutAttempt.current || logoutPending) return;
    logoutAttempt.current = true;
    setLogoutPending(true);
    const ok = await logout();
    if (!ok) {
      logoutAttempt.current = false;
      setLogoutPending(false);
      setLogoutError(true);
    }
  }

  return (
    <div className="auth-menu">
      <button type="button" className="auth-menu-trigger" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        <span className="auth-menu-avatar" aria-hidden="true">{(user.email || "계정").slice(0, 1).toUpperCase()}</span>
        <span className="auth-menu-email">{user.email || "Google 계정"}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {isOpen ? (
        <section className="auth-menu-panel" aria-label="계정 메뉴">
          <p className="auth-menu-label">인증된 Google 이메일</p>
          <p className="auth-menu-full-email">{user.email || "이메일 정보 없음"}</p>
          <p className="auth-menu-storage">프로젝트는 이 브라우저에 저장됩니다.</p>
          <button className="auth-menu-logout" type="button" disabled={logoutPending} onClick={() => void handleLogout()}>
            {logoutPending ? "로그아웃 중…" : "Blueprint에서 로그아웃"}
          </button>
          {logoutError ? <p className="auth-menu-error" role="alert">로그아웃하지 못했습니다. 다시 시도해 주세요.</p> : null}
          <p className="auth-menu-note">이 작업은 Google 계정에서 로그아웃하지 않습니다.</p>
        </section>
      ) : null}
    </div>
  );
}
