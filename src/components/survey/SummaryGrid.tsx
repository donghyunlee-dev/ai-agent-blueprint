import {
  AUTH_LABELS,
  AUTO_LABELS,
  FEATURE_LABELS,
  LABELS,
  NOTIF_LABELS,
  SEC_LABELS,
  TOOL_LABELS,
} from "../../features/survey/constants";
import { stripEmoji } from "../../features/survey/textSanitizer";
import { SurveyFormData } from "../../features/survey/types";

interface SummaryGridProps {
  formData: SurveyFormData;
}

interface SummaryGroupProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

interface SummaryFieldProps {
  label: string;
  value: string;
}

function SummaryGroup({ title, description, children }: SummaryGroupProps) {
  return (
    <section className="summary-group">
      <div className="summary-group-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="summary-group-body">{children}</div>
    </section>
  );
}

function SummaryField({ label, value }: SummaryFieldProps) {
  return (
    <div className="summary-field">
      <div className="summary-field-label">{label}</div>
      <div className="summary-field-value">{value}</div>
    </div>
  );
}

function SummaryChips({ items }: { items: string[] }) {
  return (
    <div className="summary-chips">
      {items.map((item) => (
        <span className="summary-chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function mapLabels(values: string[], labels: Record<string, string>) {
  return values.map((value) => stripEmoji(labels[value] || value));
}

export function SummaryGrid({ formData }: SummaryGridProps) {
  const serviceFeatures = mapLabels(formData.features, FEATURE_LABELS);
  const authTypes = mapLabels(formData.authTypes, AUTH_LABELS);
  const notifChannels = mapLabels(formData.notifChannels, NOTIF_LABELS);
  const automationItems = mapLabels(formData.automation, AUTO_LABELS);
  const toolItems = mapLabels(formData.tools, TOOL_LABELS);
  const securityItems = mapLabels(formData.security, SEC_LABELS);

  const envValue = stripEmoji(LABELS.env[formData.env as keyof typeof LABELS.env] || formData.env);
  const usersValue = stripEmoji(LABELS.users[formData.users as keyof typeof LABELS.users] || formData.users);
  const osValue = stripEmoji(LABELS.os[formData.os as keyof typeof LABELS.os] || formData.os);
  const dbValue = stripEmoji(LABELS.db[formData.db as keyof typeof LABELS.db] || formData.db);
  const dbExistValue = stripEmoji(
    formData.db === "yes" ? (formData.dbExist === "yes" ? "기존 DB 보유" : "신규 구축") : "해당 없음",
  );
  const dbTypeValue = stripEmoji(
    formData.dbType ? LABELS.dbType[formData.dbType as keyof typeof LABELS.dbType] || formData.dbType : "미선택",
  );
  const authValue = stripEmoji(LABELS.auth[formData.auth as keyof typeof LABELS.auth] || formData.auth);
  const notifValue = stripEmoji(LABELS.notif[formData.notif as keyof typeof LABELS.notif] || formData.notif);
  const agentValue = stripEmoji(LABELS.aiAgent[formData.aiAgent as keyof typeof LABELS.aiAgent] || formData.aiAgent);
  const gitValue = stripEmoji(LABELS.git[formData.git as keyof typeof LABELS.git] || formData.git);
  const deployValue = stripEmoji(LABELS.deploy[formData.deploy as keyof typeof LABELS.deploy] || formData.deploy);
  const testValue = stripEmoji(LABELS.test[formData.test as keyof typeof LABELS.test] || formData.test);
  const timelineValue = stripEmoji(LABELS.timeline[formData.timeline as keyof typeof LABELS.timeline] || formData.timeline);
  const devExistValue = stripEmoji(LABELS.devExist[formData.devExist as keyof typeof LABELS.devExist] || formData.devExist);

  return (
    <div className="summary-layout">
      <SummaryGroup title="서비스 개요" description="무엇을 만들고 싶은지, 핵심 기능을 정리합니다.">
        <div className="summary-hero-card">
          <div className="summary-service-name">{formData.serviceName}</div>
          <p className="summary-service-desc">{formData.serviceDesc}</p>
        </div>
        <div className="summary-feature-block">
          <div className="summary-subtitle">주요 기능</div>
          <SummaryChips items={serviceFeatures} />
        </div>
      </SummaryGroup>

      <SummaryGroup title="실행 환경" description="사용 환경과 사용자 규모에 따라 기술 선택과 배포 방식이 달라집니다.">
        <div className="summary-field-grid">
          <SummaryField label="서비스 실행 환경" value={envValue} />
          <SummaryField label="사용자 규모" value={usersValue} />
          <SummaryField label="개발 운영체제" value={osValue} />
        </div>
      </SummaryGroup>

      <SummaryGroup title="데이터·로그인" description="데이터 저장/조회와 로그인 구조는 비용과 보안을 좌우합니다.">
        <div className="summary-field-grid">
          <SummaryField label="데이터 필요" value={dbValue} />
          <SummaryField label="기존 DB 보유 여부" value={dbExistValue} />
          <SummaryField label="데이터베이스 종류" value={dbTypeValue} />
          <SummaryField label="로그인 기능" value={authValue} />
        </div>
        {authTypes.length ? (
          <div className="summary-feature-block">
            <div className="summary-subtitle">로그인 방식</div>
            <SummaryChips items={authTypes} />
          </div>
        ) : null}
      </SummaryGroup>

      <SummaryGroup title="알림·자동화·도구" description="운영에 필요한 알림, 반복 작업 자동화, 협업 도구를 정리합니다.">
        <div className="summary-field-grid">
          <SummaryField label="알림 기능" value={notifValue} />
          <SummaryField label="AI Agent" value={agentValue} />
          <SummaryField label="버전 관리" value={gitValue} />
        </div>
        <div className="summary-dual-block">
          <div className="summary-feature-block">
            <div className="summary-subtitle">알림 채널</div>
            <SummaryChips items={notifChannels.length ? notifChannels : ["없음"]} />
          </div>
          <div className="summary-feature-block">
            <div className="summary-subtitle">자동화 항목</div>
            <SummaryChips items={automationItems.length ? automationItems : ["없음"]} />
          </div>
        </div>
        <div className="summary-feature-block">
          <div className="summary-subtitle">업무·협업 도구</div>
          <SummaryChips items={toolItems.length ? toolItems : ["없음"]} />
        </div>
      </SummaryGroup>

      <SummaryGroup title="배포·보안·기타" description="배포 대상, 보안/규정, 테스트/일정을 정리합니다.">
        <div className="summary-field-grid">
          <SummaryField label="배포 환경" value={deployValue} />
          <SummaryField label="테스트 환경" value={testValue} />
          <SummaryField label="일정" value={timelineValue} />
          <SummaryField label="개발자 보유 여부" value={devExistValue} />
        </div>
        <div className="summary-feature-block">
          <div className="summary-subtitle">보안 항목</div>
          <SummaryChips items={securityItems.length ? securityItems : ["없음"]} />
        </div>
        {formData.extraNote ? (
          <div className="summary-note-card">
            <div className="summary-subtitle">추가 메모</div>
            <p>{formData.extraNote}</p>
          </div>
        ) : null}
      </SummaryGroup>
    </div>
  );
}
