import { envOptions, osOptions, userOptions } from "../../../features/survey/constants";
import { SurveyFormData } from "../../../features/survey/types";
import { ChoiceCard } from "../ChoiceCard";

interface EnvironmentStepProps {
  formData: SurveyFormData;
  validationFieldId: string | null;
  validationMessage: string | null;
  onFieldChange: <K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) => void;
}

export function EnvironmentStep({ formData, validationFieldId, validationMessage, onFieldChange }: EnvironmentStepProps) {
  return (
    <div className="step-card active">
      <h2>🖥️ 사용 환경</h2>
      <p className="desc">서비스가 실행될 위치와 사용자 규모에 따라 구성과 배포 방식이 달라집니다.</p>

      {validationMessage ? <div className="validation-banner" role="alert">{validationMessage}</div> : null}

      <div className={`form-group ${validationFieldId === "environment-env-section" ? "validation-target" : ""}`} id="environment-env-section">
        <label className="field-label">서비스 실행 환경 <span className="required">*</span></label>
        <div className="choice-grid">
          {envOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.env === option.value}
              onSelect={() => onFieldChange("env", option.value)}
            />
          ))}
        </div>
      </div>

      <hr className="section-divider" />

      <div className={`form-group ${validationFieldId === "environment-users-section" ? "validation-target" : ""}`} id="environment-users-section">
        <label className="field-label">사용자 규모 <span className="required">*</span></label>
        <div className="choice-grid cols-3">
          {userOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.users === option.value}
              onSelect={() => onFieldChange("users", option.value)}
            />
          ))}
        </div>
      </div>

      <div className={`form-group ${validationFieldId === "environment-os-section" ? "validation-target" : ""}`} id="environment-os-section">
        <label className="field-label">개발 운영체제 (OS) <span className="required">*</span></label>
        <div className="choice-grid cols-3">
          {osOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.os === option.value}
              onSelect={() => onFieldChange("os", option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
