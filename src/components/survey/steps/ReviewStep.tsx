import { StructuredRecommendation, SurveyFormData } from "../../../features/survey/types";
import { ResultPanel } from "../ResultPanel";
import { SummaryGrid } from "../SummaryGrid";

interface ReviewStepProps {
  formData: SurveyFormData;
  result: StructuredRecommendation | null;
  isSubmitting: boolean;
  onPrev: () => void;
  onSubmit: () => void;
  onCopy: () => void | Promise<void>;
  onDownloadMarkdown: () => void;
  onReset: () => void;
}

export function ReviewStep({ formData, result, isSubmitting, onPrev, onSubmit, onCopy, onDownloadMarkdown, onReset }: ReviewStepProps) {
  return (
    <div className="step-card active review-step">
      <section className="review-section">
        <h2>완성된 Blueprint를 확인하세요</h2>
        <p className="desc">확정한 설계를 점검한 뒤 OpenAI에 전달해 요구사항명세서를 생성합니다.</p>
        <SummaryGrid formData={formData} />
      </section>

      <section className="review-cta-panel">
        <div className="review-cta-copy">
          <div className="review-cta-kicker">GENERATE REQUIREMENTS</div>
          <h3>요구사항명세서 만들기</h3>
          <p>설계 보드 전체를 OpenAI에 전달해 기술 구성, 실행 체크리스트와 주의사항을 포함한 명세서를 생성합니다.</p>
        </div>
        <div className="review-cta-actions">
          <button className="btn btn-ghost" type="button" onClick={onPrev} disabled={isSubmitting}>이전 단계로</button>
          <button className="btn btn-submit review-submit-btn" type="button" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <span className="spinner" /> : null}
            {isSubmitting ? "요구사항을 작성 중입니다..." : "요구사항명세서 생성"}
          </button>
        </div>
      </section>

      <ResultPanel
        formData={formData}
        result={result}
        isSubmitting={isSubmitting}
        onCopy={onCopy}
        onDownloadMarkdown={onDownloadMarkdown}
        onReset={onReset}
      />
    </div>
  );
}
