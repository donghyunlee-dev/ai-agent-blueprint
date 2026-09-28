import { ReactElement, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Button, Modal, Spinner } from "@sfood/ui";
import { buildCustomGuideDocument, guideDocuments } from "../../features/docs/docsRegistry";
import { savePrdContext } from "../../features/prd/contextStorage";
import {
  GuideDocKey,
  StructuredRecommendation,
  SurveyFormData,
} from "../../features/survey/types";

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
}

function normalizeCodeText(children: React.ReactNode) {
  const content = Array.isArray(children) ? children.join("") : String(children ?? "");
  return content.replace(/\n$/, "");
}

function MarkdownCodeBlock({ className, children }: CodeBlockProps) {
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
      const child = children as ReactElement<CodeBlockProps> | undefined;
      if (child?.props) {
        return (
          <MarkdownCodeBlock className={child.props.className}>
            {child.props.children}
          </MarkdownCodeBlock>
        );
      }

      return <pre>{children}</pre>;
    },
    code({ className, children, ...props }: CodeBlockProps) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };
}

interface ResultPanelProps {
  formData: SurveyFormData;
  result: StructuredRecommendation | null;
  isSubmitting: boolean;
  onCopy: () => void | Promise<void>;
  onDownloadMarkdown: () => void;
  onReset: () => void;
}

export function ResultPanel({
  formData,
  result,
  isSubmitting,
  onCopy,
  onDownloadMarkdown,
  onReset,
}: ResultPanelProps) {
  const navigate = useNavigate();
  const [selectedDocKey, setSelectedDocKey] = useState<GuideDocKey | null>(null);
  const [savedGuideDocument, setSavedGuideDocument] = useState<ReturnType<
    typeof buildCustomGuideDocument
  > | null>(null);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const availableDocs = useMemo(() => {
    if (!result) return [];

    const customDoc = buildCustomGuideDocument(formData, result);
    return [
      savedGuideDocument || customDoc,
      ...result.guideDocs
        .filter((docKey) => docKey !== "custom-setup-guide")
        .map((docKey) => guideDocuments[docKey])
        .filter(Boolean),
    ];
  }, [formData, result, savedGuideDocument]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocKey) return null;
    if (savedGuideDocument && selectedDocKey === savedGuideDocument.key) {
      return savedGuideDocument;
    }
    if (selectedDocKey === "custom-setup-guide" && result) {
      return buildCustomGuideDocument(formData, result);
    }

    return guideDocuments[selectedDocKey];
  }, [formData, result, savedGuideDocument, selectedDocKey]);

  useEffect(() => {
    setSavedGuideDocument(null);
    setHasAttemptedSave(false);
  }, [result?.title]);

  useEffect(() => {
    if (!result || hasAttemptedSave) return;

    const matchedDocs = result.guideDocs.filter((docKey) => docKey !== "custom-setup-guide");
    if (matchedDocs.length > 0) {
      setHasAttemptedSave(true);
      return;
    }

    const customDoc = buildCustomGuideDocument(formData, result);
    setHasAttemptedSave(true);

    void (async () => {
      try {
        const response = await fetch("/__guide/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: customDoc.title,
            suggestedKey: `${formData.serviceName || "project"}-${formData.env || "env"}-setup-guide`,
            tags: ["custom", formData.env, formData.aiAgent, formData.deploy].filter(Boolean),
            content: customDoc.content,
          }),
        });

        if (!response.ok) return;
        const savedDocument = (await response.json()) as typeof customDoc;
        setSavedGuideDocument(savedDocument);
      } catch {
        // dev endpoint may be unavailable in static hosting
      }
    })();
  }, [formData, hasAttemptedSave, result]);
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [result, isSubmitting],
  );

  if (!result && !isSubmitting) return null;

  function handleCreatePrd() {
    if (!result) return;

    const prdContext = {
      formData,
      recommendation: result,
    };

    savePrdContext(prdContext);
    navigate("/prd", { state: { prdContext } });
  }

  return (
    <div className="result-panel result-report-surface" id="recommendation-report">
      <section className="report-document-shell" id="recommendation-report-top">
        <div className="report-document-inner">
          <div className="report-header">
            <div>
              <div className="report-kicker">REQUIREMENTS SPECIFICATION</div>
              <h3>AI 요구사항명세서</h3>
            </div>
            <Badge variant={isSubmitting ? "warning" : "success"}>{isSubmitting ? "분석 진행 중" : "명세서 생성 완료"}</Badge>
          </div>
          <div className="report-meta">
            <span>생성일: {generatedAt}</span>
            <span>입력 기반: Blueprint 설계 전체 분석</span>
          </div>

          {isSubmitting && !result ? (
            <section className="analysis-panel" aria-live="polite">
              <Spinner size="lg" />
              <div className="analysis-copy">
                <span className="analysis-kicker">Thinking</span>
                <h4>AI가 요구사항명세서를 작성하고 있습니다</h4>
                <p>
                  확정된 설계를 바탕으로 기술 구성, 기능 요구사항, 연동 포인트와 운영 전 점검 사항을 정리하는 중입니다.
                </p>
              </div>
              <div className="analysis-steps">
                <div>1. Blueprint 결정을 기술 요구사항으로 변환</div>
                <div>2. 개발 환경과 협업 도구 연결 구조 설계</div>
                <div>3. 설치 및 설정 순서를 문서로 정리</div>
              </div>
            </section>
          ) : null}

          {result ? (
            <>
              <article className="report-article markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={renderMarkdownComponents()}
                >
                  {result.reportMarkdown}
                </ReactMarkdown>
              </article>

              <div className="report-guide-footer">
                <div className="report-guide-copy">
                  <strong>관련 가이드 문서</strong>
                  <p>아래 문서를 이어서 보면 실제 설치와 연동 작업을 바로 이어갈 수 있습니다.</p>
                </div>
                <div className="guide-doc-actions">
                  {availableDocs.length ? (
                    availableDocs.map((document) => (
                      <Button
                        variant="ghost"
                        type="button"
                        key={document.key}
                        onClick={() => setSelectedDocKey(document.key)}
                      >
                        {document.title}
                      </Button>
                    ))
                  ) : null}
                </div>
              </div>

              <div className="report-action-stack">
                <section className="report-actions-shell">
                  <div className="report-actions-copy">
                    <strong>결과 활용</strong>
                    <p>현재 리포트를 복사하거나 Markdown 문서로 내려받고, 설문을 다시 시작할 수 있습니다.</p>
                  </div>
                  <div className="report-actions-toolbar">
                    <Button variant="ghost" type="button" onClick={onCopy}>
                      결과 복사
                    </Button>
                    <Button variant="ghost" type="button" onClick={onDownloadMarkdown}>
                      Markdown 다운로드
                    </Button>
                    <Button variant="ghost" type="button" onClick={onReset}>
                      다시 시작
                    </Button>
                  </div>
                </section>

                <section className="report-next-step-panel">
                  <div className="report-next-step-copy">
                    <span className="report-next-step-kicker">Next Step</span>
                    <strong>이 요구사항을 바탕으로 PRD를 작성합니다</strong>
                    <p>확정된 요구사항과 연결 가이드를 가져가 제품 목표, 사용자 시나리오와 출시 계획을 구체화합니다.</p>
                  </div>
                  <Button className="report-primary-action" type="button" onClick={handleCreatePrd}>
                    PRD 작성하기
                  </Button>
                </section>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {selectedDoc ? (
        <Modal open onClose={() => setSelectedDocKey(null)} title={selectedDoc.title} size="lg">
            <div className="doc-modal-content markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={renderMarkdownComponents()}
              >
                {selectedDoc.content}
              </ReactMarkdown>
            </div>
        </Modal>
      ) : null}
    </div>
  );
}
