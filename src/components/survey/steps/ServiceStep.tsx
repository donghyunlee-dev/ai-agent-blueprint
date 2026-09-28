import { featureOptions } from "../../../features/survey/constants";
import { SurveyFormData } from "../../../features/survey/types";
import { ChoiceCard } from "../ChoiceCard";

interface ServiceStepProps {
  formData: SurveyFormData;
  validationFieldId: string | null;
  validationMessage: string | null;
  onFieldChange: <K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) => void;
  onToggleArray: (field: "features", value: string) => void;
}

export function ServiceStep({
  formData,
  validationFieldId,
  validationMessage,
  onFieldChange,
  onToggleArray,
}: ServiceStepProps) {
  return (
    <div className="step-card active">
      <h2>📝 서비스 소개</h2>
      <p className="desc">어떤 문제를 해결하고 싶은지, 필요한 기능을 간단히 알려주세요.</p>

      {validationMessage ? <div className="validation-banner" role="alert">{validationMessage}</div> : null}

      <div
        className={`form-group ${validationFieldId === "service-name-section" ? "validation-target" : ""}`}
        id="service-name-section"
      >
        <label className="field-label">
          서비스 이름 또는 프로젝트명 <span className="required">*</span>
        </label>
        <input
          type="text"
          value={formData.serviceName}
          onChange={(event) => onFieldChange("serviceName", event.target.value)}
          placeholder="예) 주간 매출 분석 대시보드, 고객 리포트 자동화"
        />
      </div>

      <div
        className={`form-group ${validationFieldId === "service-desc-section" ? "validation-target" : ""}`}
        id="service-desc-section"
      >
        <label className="field-label">
          서비스 설명 <span className="required">*</span>
        </label>
        <textarea
          value={formData.serviceDesc}
          onChange={(event) => onFieldChange("serviceDesc", event.target.value)}
          placeholder="예) CSV 업로드 후 매출 통계·평균·추이를 자동으로 시각화하는 백오피스 서비스"
        />
        <p className="field-hint">목표, 사용자, 기대 결과를 구체적으로 적을수록 더 정확한 추천을 받습니다.</p>
      </div>

      <div
        className={`form-group ${validationFieldId === "service-features-section" ? "validation-target" : ""}`}
        id="service-features-section"
      >
        <label className="field-label">주요 기능 (복수 선택 가능)</label>
        <div className="choice-grid cols-2">
          {featureOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="checkbox"
              selected={formData.features.includes(option.value)}
              onSelect={() => onToggleArray("features", option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
