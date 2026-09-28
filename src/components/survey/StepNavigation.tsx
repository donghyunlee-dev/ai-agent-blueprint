interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  isSubmitting,
  onPrev,
  onNext,
  onSubmit,
}: StepNavigationProps) {
  if (currentStep === 0 || currentStep === totalSteps) return null;

  return (
    <div className="nav-buttons">
      <button
        className="btn btn-ghost"
        type="button"
        onClick={onPrev}
        style={{ visibility: currentStep > 0 ? "visible" : "hidden" }}
      >
        ← 이전
      </button>
      <div className="nav-actions">
        {currentStep < totalSteps ? (
          <button className="btn btn-primary-solid" type="button" onClick={onNext}>
            다음 →
          </button>
        ) : (
          <button className="btn btn-submit" type="button" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <span className="spinner" /> : null}
            🚀 AI 환경 추천 받기
          </button>
        )}
      </div>
    </div>
  );
}
