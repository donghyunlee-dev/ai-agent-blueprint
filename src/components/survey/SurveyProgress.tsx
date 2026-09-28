interface SurveyProgressProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepTitles: readonly string[];
  onSelect: (step: number) => void;
}

export function SurveyProgress({
  currentStep,
  totalSteps,
  stepTitle,
  stepTitles,
  onSelect,
}: SurveyProgressProps) {
  const fillPercent = (currentStep / totalSteps) * 100;
  const segments = totalSteps;
  const displayLabel = currentStep > 0 ? `STEP ${currentStep}` : stepTitle;
  return (
    <div className="progress-wrap">
      <div className="progress-header">
        <span className="step-label">{displayLabel}</span>
        <span className="step-count">{`${currentStep} / ${totalSteps}`}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `100%` }} />
      </div>
      <div className="step-dots">
        {Array.from({ length: segments }).map((_, i) => {
          const segStartPercent = (i / segments) * 100;
          const segEndPercent = ((i + 1) / segments) * 100;
          const isDone = fillPercent >= segEndPercent;
          const isActive = !isDone && fillPercent > segStartPercent;
          const targetStep = Math.floor((i / segments) * totalSteps);
          return (
            <button
              type="button"
              className={`step-dot ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
              key={`seg-${i}`}
              title={`단계 ${i + 1}`}
              onClick={() => {
                if (targetStep < currentStep) onSelect(targetStep);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
