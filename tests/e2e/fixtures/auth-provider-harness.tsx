import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "../../../src/features/auth/AuthProvider";

function ProviderProbe() {
  const { status, user, ownerKey, checkSession, logout } = useAuth();
  const [memoryProjectOwner, setMemoryProjectOwner] = useState<string | null>(null);

  useEffect(() => {
    const clearMemory = () => setMemoryProjectOwner(null);
    window.addEventListener("blueprint:clear-session-state", clearMemory);
    return () => window.removeEventListener("blueprint:clear-session-state", clearMemory);
  }, []);

  useEffect(() => {
    setMemoryProjectOwner(status === "authenticated" ? user?.subject ?? null : null);
  }, [status, user]);

  return (
    <main>
      <output data-testid="auth-status">{status}</output>
      <output data-testid="auth-subject">{user?.subject ?? ""}</output>
      <output data-testid="owner-context-present">{ownerKey ? "yes" : "no"}</output>
      <output data-testid="memory-project-owner">{memoryProjectOwner ?? ""}</output>
      <button type="button" onClick={() => void checkSession()}>Check session</button>
      <button type="button" onClick={() => window.dispatchEvent(new Event("blueprint:session-expired"))}>Expire session</button>
      <button type="button" onClick={() => void logout()}>Logout</button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider><ProviderProbe /></AuthProvider>,
);
