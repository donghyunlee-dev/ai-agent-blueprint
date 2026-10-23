import type { ReactNode } from "react";
import type { ConversationSummary as Summary } from "../../domain/blueprint/types.js";
import { ConversationSummary } from "./ConversationSummary.js";

export function ConversationWorkspace({ children, summary }: { children: ReactNode; summary?: Summary }) {
  return <div className="conversation-stage-layout">
    {children}
    <aside className="conversation-stage-inspector" aria-label="요약">
      <ConversationSummary summary={summary} />
    </aside>
  </div>;
}
