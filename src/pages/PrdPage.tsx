import { ChangeEvent, ReactElement, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Button, EmptyState, FileUpload, Modal, Spinner, Textarea } from "@sfood/ui";
import { SurveyHeader } from "../components/survey/SurveyHeader";
import {
  buildCustomGuideDocument,
  guideDocuments,
} from "../features/docs/docsRegistry";
import { loadPrdContext } from "../features/prd/contextStorage";
import { extractReferenceDocument } from "../features/prd/fileExtraction";
import { prdService } from "../features/prd/prdService";
import {
  PrdFormData,
  PrdGenerationContext,
  StructuredPrd,
  UploadedReferenceDocument,
} from "../features/prd/types";
import "../styles/survey.css";
import "../styles/prd.css";

interface LocationState {
  prdContext?: PrdGenerationContext;
}

function normalizeCodeText(children: React.ReactNode) {
  const content = Array.isArray(children) ? children.join("") : String(children ?? "");
  return content.replace(/\n$/, "");
}

function MarkdownCodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeText = normalizeCodeText(children);
  const language = className?.replace("language-", "") || "text";

  async function handleCopy() {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-toolbar">
        <span className="markdown-code-language">{language}</span>
        <Button variant="ghost" size="sm" className="markdown-copy-btn" type="button" onClick={handleCopy}>
          {copied ? "복사됨" : "코드 복사"}
        </Button>
      </div>
      <pre>
        <code className={className}>{codeText}</code>
      </pre>
    </div>
  );
}

function renderMarkdownComponents() {
  return {
    pre({ children }: { children?: React.ReactNode }) {
      const child = children as ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
      if (child?.props) {
        return (
          <MarkdownCodeBlock className={child.props.className}>
            {child.props.children}
          </MarkdownCodeBlock>
        );
      }

      return <pre>{children}</pre>;
    },
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };
}

function buildInitialPrdForm(context: PrdGenerationContext): PrdFormData {
  return {
    documentTitle: `${context.formData.serviceName || "프로젝트"} PRD`,
    projectOverview: context.formData.serviceDesc,
    problemStatement: context.formData.extraNote || "",
    goals: context.recommendation.summary,
    targetUsers: "",
    userScenarios: "",
    functionalRequirements: context.formData.features.join("\n"),
    outOfScope: "",
    dataAndIntegrations: "",
    constraints: "",
    successMetrics: "",
    releasePlan: "",
    additionalNotes: "",
  };
}

function PrdField({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label className="prd-field">
      <span>{label}</span>
      <Textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function PrdSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="prd-section">
      <div className="prd-section-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="prd-section-body">{children}</div>
    </section>
  );
}

export function PrdPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const context = state?.prdContext || loadPrdContext();

  const [selectedGuideKey, setSelectedGuideKey] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedReferenceDocument[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<StructuredPrd | null>(null);

  const [formData, setFormData] = useState<PrdFormData>(() =>
    context ? buildInitialPrdForm(context) : {
      documentTitle: "",
      projectOverview: "",
      problemStatement: "",
      goals: "",
      targetUsers: "",
      userScenarios: "",
      functionalRequirements: "",
      outOfScope: "",
      dataAndIntegrations: "",
      constraints: "",
      successMetrics: "",
      releasePlan: "",
      additionalNotes: "",
    },
  );

  const guideList = useMemo(() => {
    if (!context) return [];

    const customGuide = buildCustomGuideDocument(context.formData, context.recommendation);
    return [
      customGuide,
      ...context.recommendation.guideDocs
        .filter((key) => key !== "custom-setup-guide")
        .map((key) => guideDocuments[key])
        .filter(Boolean),
    ];
  }, [context]);

  const selectedGuide = useMemo(() => {
    if (!selectedGuideKey) return null;
    return guideList.find((document) => document.key === selectedGuideKey) || null;
  }, [guideList, selectedGuideKey]);

  if (!context) {
    return (
      <div className="prd-shell">
        <div className="orb orb-1" aria-hidden="true" />
        <div className="orb orb-2" aria-hidden="true" />
        <div className="orb orb-3" aria-hidden="true" />
        <SurveyHeader />
        <main className="prd-main">
          <section className="prd-empty-state"><EmptyState title="PRD를 만들기 위한 요구사항명세서가 없습니다" description="Blueprint에서 요구사항명세서를 먼저 만든 뒤 PRD 작성으로 이동해 주세요." action={<Link className="btn btn-submit" to="/survey">설계 페이지로 이동</Link>} /></section>
        </main>
      </div>
    );
  }

  const activeContext = context;

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextDocuments = await Promise.all(files.map((file) => extractReferenceDocument(file)));
    setUploadedDocuments((current) => [...current, ...nextDocuments]);
    event.target.value = "";
  }

  function updateField<K extends keyof PrdFormData>(field: K, value: PrdFormData[K]) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const nextResult = await prdService.generate({
        context: activeContext,
        formData,
        uploadedDocuments,
        guideDocuments: guideList.map((document) => ({
          title: document.title,
          content: document.content,
          path: document.path,
        })),
      });
      setResult(nextResult);
      window.setTimeout(() => {
        document.getElementById("prd-result-document")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.prdMarkdown);
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.prdMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formData.documentTitle || "prd"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="prd-shell">
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />
      <SurveyHeader />
      <main className="prd-main">
        <section className="prd-hero">
          <div className="prd-hero-copy">
            <span className="prd-kicker">Requirements Builder</span>
            <h1>요구사항을 제품 정의서로 구체화합니다</h1>
            <p>
              Blueprint 요구사항명세서, 환경설정 가이드와 참고 문서를 반영해 개발 착수용 PRD를 작성합니다.
            </p>
          </div>
          <div className="prd-hero-actions">
            <Button variant="ghost" type="button" onClick={() => navigate("/survey")}>
              설문 결과로 돌아가기
            </Button>
            <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <><Spinner size="sm" /> PRD 생성 중...</> : "PRD 생성"}
            </Button>
          </div>
        </section>

        <section className="prd-reference-bar">
          <div>
            <strong>기준 추천 결과</strong>
            <p>{context.recommendation.title}</p>
          </div>
          <div>
            <strong>참조 가이드</strong>
            <p>{guideList.length}개 문서 연결됨</p>
          </div>
        </section>

        <section className="prd-layout">
          <div className="prd-form-column">
            <PrdSection title="기본 정보" description="문서 목적과 프로젝트 배경을 먼저 정리합니다.">
              <PrdField
                label="문서 제목"
                value={formData.documentTitle}
                onChange={(value) => updateField("documentTitle", value)}
                placeholder="예: 쓰푸드몰 품절 자동화 서비스 PRD"
                rows={3}
              />
              <PrdField
                label="프로젝트 개요"
                value={formData.projectOverview}
                onChange={(value) => updateField("projectOverview", value)}
                placeholder="서비스 개요와 현재 배경을 정리합니다."
              />
            </PrdSection>

            <PrdSection title="문제와 목표" description="무엇을 해결하고 어떤 결과를 내야 하는지 적습니다.">
              <PrdField
                label="문제 정의"
                value={formData.problemStatement}
                onChange={(value) => updateField("problemStatement", value)}
                placeholder="현업에서 겪는 문제, 비효율, 리스크를 적습니다."
              />
              <PrdField
                label="목표"
                value={formData.goals}
                onChange={(value) => updateField("goals", value)}
                placeholder="이 문서로 달성하려는 목표와 기대 효과를 적습니다."
              />
              <PrdField
                label="성공 지표"
                value={formData.successMetrics}
                onChange={(value) => updateField("successMetrics", value)}
                placeholder="예: 처리 시간 단축, 오류 감소, 수동 작업 감소"
              />
            </PrdSection>

            <PrdSection title="사용자와 시나리오" description="누가 어떤 흐름으로 사용하는지 정리합니다.">
              <PrdField
                label="주요 사용자"
                value={formData.targetUsers}
                onChange={(value) => updateField("targetUsers", value)}
                placeholder="예: 운영 담당자, 관리자, 실무자"
              />
              <PrdField
                label="핵심 사용자 시나리오"
                value={formData.userScenarios}
                onChange={(value) => updateField("userScenarios", value)}
                placeholder="사용자가 어떤 순서로 기능을 쓰는지 단계별로 적습니다."
              />
            </PrdSection>

            <PrdSection title="기능 요구사항" description="실제로 개발해야 할 기능과 제외 범위를 분리합니다.">
              <PrdField
                label="핵심 기능 요구사항"
                value={formData.functionalRequirements}
                onChange={(value) => updateField("functionalRequirements", value)}
                placeholder="기능별로 줄바꿈해서 적습니다."
                rows={8}
              />
              <PrdField
                label="제외 범위"
                value={formData.outOfScope}
                onChange={(value) => updateField("outOfScope", value)}
                placeholder="이번 단계에서 하지 않을 항목을 적습니다."
              />
            </PrdSection>

            <PrdSection title="데이터와 운영 제약" description="연동, 인증, 배포, 일정 같은 제약을 명확히 합니다.">
              <PrdField
                label="데이터 및 연동 요구사항"
                value={formData.dataAndIntegrations}
                onChange={(value) => updateField("dataAndIntegrations", value)}
                placeholder="DB, 외부 시스템, 인증, API 연동 요구사항을 적습니다."
              />
              <PrdField
                label="운영 및 제약사항"
                value={formData.constraints}
                onChange={(value) => updateField("constraints", value)}
                placeholder="배포 환경, 보안 제약, 운영 정책, 일정 제약을 적습니다."
              />
              <PrdField
                label="릴리즈 계획"
                value={formData.releasePlan}
                onChange={(value) => updateField("releasePlan", value)}
                placeholder="MVP와 이후 확장 계획을 적습니다."
              />
            </PrdSection>

            <PrdSection title="참고 자료" description="이미 작성된 문서나 메모를 함께 반영합니다.">
              <PrdField
                label="추가 메모"
                value={formData.additionalNotes}
                onChange={(value) => updateField("additionalNotes", value)}
                placeholder="추가로 반영해야 할 의사결정, 정책, 요청사항을 적습니다."
              />
              <label className="prd-upload-field">
                <span>참고 파일 업로드</span>
                <FileUpload multiple label="참고 문서 선택 또는 드래그" onChange={(files) => void handleUpload({ target: { files, value: "" } } as ChangeEvent<HTMLInputElement>)} />
                <small>
                  파일 형식은 고정하지 않지만, 현재 자동 텍스트 추출은 읽을 수 있는 문서 중심으로 동작합니다.
                </small>
              </label>
              <div className="prd-upload-list">
                {uploadedDocuments.length ? (
                  uploadedDocuments.map((document) => (
                    <article className={`prd-upload-item ${document.status}`} key={`${document.fileName}-${document.message}`}>
                      <div>
                        <strong>{document.fileName}</strong>
                        <p>{document.message}</p>
                      </div>
                      <span>{document.status === "ready" ? "반영 예정" : document.status === "unsupported" ? "확인 필요" : "읽기 실패"}</span>
                    </article>
                  ))
                ) : (
                  <div className="prd-upload-empty">아직 업로드한 문서가 없습니다.</div>
                )}
              </div>
            </PrdSection>
          </div>

          <aside className="prd-side-column">
            <section className="prd-side-panel">
              <h3>환경설정 가이드</h3>
              <p>PRD 생성 시 아래 가이드 문서도 함께 참고합니다.</p>
              <div className="prd-guide-actions">
                {guideList.map((document) => (
                  <Button variant="ghost" type="button" key={document.key} onClick={() => setSelectedGuideKey(document.key)}>
                    {document.title}
                  </Button>
                ))}
              </div>
            </section>

            <section className="prd-side-panel">
              <h3>추천 결과 요약</h3>
              <p>{context.recommendation.summary}</p>
              <div className="prd-side-summary">
                <strong>{activeContext.formData.serviceName}</strong>
                <span>{activeContext.formData.serviceDesc}</span>
              </div>
            </section>
          </aside>
        </section>

        {isGenerating && !result ? (
          <section className="analysis-panel prd-analysis-panel" aria-live="polite">
            <div className="analysis-orb" aria-hidden="true" />
            <div className="analysis-copy">
              <span className="analysis-kicker">Writing PRD</span>
              <h4>입력 자료와 가이드를 바탕으로 PRD를 작성하고 있습니다</h4>
              <p>기능 요구사항, 사용자 시나리오, 운영 제약과 출시 계획을 분석해 PRD를 생성하는 중입니다.</p>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="report-document-shell prd-result-shell" id="prd-result-document">
            <div className="report-document-inner">
              <div className="report-header">
                <div>
                  <div className="report-kicker">Requirements Document</div>
                  <h3>{result.title}</h3>
                </div>
                <Badge variant="success">PRD 생성 완료</Badge>
              </div>
              <div className="report-meta">
                <span>문서 유형: Product Requirements Document</span>
                <span>{result.summary}</span>
              </div>
              <article className="report-article markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={renderMarkdownComponents()}
                >
                  {result.prdMarkdown}
                </ReactMarkdown>
              </article>
              <div className="result-actions report-actions">
                <Button variant="ghost" type="button" onClick={handleCopy}>
                  결과 복사
                </Button>
                <Button variant="ghost" type="button" onClick={handleDownload}>
                  Markdown 다운로드
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {selectedGuide ? (
        <Modal open onClose={() => setSelectedGuideKey(null)} title={selectedGuide.title} size="lg">
            <div className="doc-modal-content markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={renderMarkdownComponents()}
              >
                {selectedGuide.content}
              </ReactMarkdown>
            </div>
        </Modal>
      ) : null}
    </div>
  );
}
