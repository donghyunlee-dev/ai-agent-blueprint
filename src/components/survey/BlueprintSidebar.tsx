import { Badge, Button, Card, Progress, Tag } from "@sfood/ui";
import { ConfirmedDecision } from "../../features/conversation/types";
import { StageId } from "../../features/conversation/blueprintQuestions";

interface BlueprintSidebarProps {
  decisions: ConfirmedDecision[];
  currentStage: StageId;
  onEdit: (fields: string[], stage: StageId) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const sections = [
  { title: "서비스 소개", stage: 1 as StageId, fields: ["serviceName", "serviceDesc", "features"] },
  { title: "사용 환경", stage: 2 as StageId, fields: ["env", "users", "os"] },
  { title: "데이터 · 로그인", stage: 3 as StageId, fields: ["db", "dbExist", "dbType", "auth", "authTypes"] },
  { title: "알림 · 자동화", stage: 4 as StageId, fields: ["notif", "notifChannels", "automation"] },
  { title: "AI · 업무 도구", stage: 5 as StageId, fields: ["aiAgent", "tools", "git"] },
  { title: "배포 · 보안", stage: 6 as StageId, fields: ["deploy", "security", "test", "timeline", "devExist", "extraNote"] },
  { title: "최종 검토", stage: 7 as StageId, fields: [] },
];

function displayValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(" · ") : value;
}

export function BlueprintSidebar({ decisions, currentStage, onEdit, isOpen = false, onClose }: BlueprintSidebarProps) {
  return (
    <aside className={`blueprint-sidebar ${isOpen ? "is-mobile-open" : ""}`} id="blueprint-sidebar" aria-label="확정된 설계">
      {onClose ? <div className="blueprint-mobile-toolbar"><Button variant="ghost" size="sm" onClick={onClose}>설계 보드 닫기</Button></div> : null}
      <div className="blueprint-sidebar-heading">
        <div><span>LIVE BLUEPRINT</span><h2>설계 보드</h2></div>
        <span>{decisions.length}개 확정</span>
      </div>
      <Progress value={currentStage} max={7} />
      <p className="blueprint-sidebar-intro">AI 제안을 직접 확정한 내용만 이곳에 반영됩니다.</p>
      <div className="blueprint-card-list">
        {sections.map((section) => {
          const items = decisions.filter((decision) => section.fields.includes(decision.field));
          return (
            <Card className={`blueprint-decision-card ${items.length ? "is-decided" : "is-pending"} ${currentStage === section.stage ? "is-current" : ""}`} key={section.title} padding="sm">
              <div className="blueprint-card-header">
                <strong>{section.title}</strong>
                {items.length ? <Button variant="ghost" size="sm" onClick={() => onEdit(section.fields, section.stage)}>수정</Button> : <Badge variant={currentStage === section.stage ? "info" : "default"}>{currentStage === section.stage ? "진행 중" : "대기"}</Badge>}
              </div>
              {items.length ? (
                <dl>{items.map((item) => <div key={item.field}><dt>{item.label}</dt><dd><Tag>{displayValue(item.value)}</Tag></dd></div>)}</dl>
              ) : <p>대화에서 제안을 확정하면 추가됩니다.</p>}
            </Card>
          );
        })}
      </div>
    </aside>
  );
}
