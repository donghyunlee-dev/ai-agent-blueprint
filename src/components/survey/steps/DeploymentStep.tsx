import { deployOptions, devExistOptions, securityOptions, testOptions, timelineOptions } from "../../../features/survey/constants";
import { SurveyFormData } from "../../../features/survey/types";
import { ChoiceCard } from "../ChoiceCard";

interface DeploymentStepProps {
  formData: SurveyFormData;
  validationFieldId: string | null;
  validationMessage: string | null;
  onFieldChange: <K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) => void;
  onToggleArray: (field: "security", value: string) => void;
}

export function DeploymentStep({ formData, validationFieldId, validationMessage, onFieldChange, onToggleArray }: DeploymentStepProps) {
  return (
    <div className="step-card active">
      <h2>🚀 배포·보안·기타</h2>
      <p className="desc">배포 대상, 보안/규정, 테스트/일정 계획을 선택하세요.</p>

      {validationMessage ? <div className="validation-banner" role="alert">{validationMessage}</div> : null}

      <div className={`form-group ${validationFieldId === "deploy-target-section" ? "validation-target" : ""}`} id="deploy-target-section">
        <label className="field-label">서비스를 어디에 배포할까요?</label>
        <div className="choice-grid cols-2">
          {deployOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.deploy === option.value}
              onSelect={() => onFieldChange("deploy", option.value)}
            />
          ))}
        </div>
      </div>

      <hr className="section-divider" />

      <div className={`form-group ${validationFieldId === "deploy-security-section" ? "validation-target" : ""}`} id="deploy-security-section">
        <label className="field-label">보안·규정 준수 항목이 있나요? (복수 선택 가능)</label>
        <div className="choice-grid cols-2">
          {securityOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="checkbox"
              selected={formData.security.includes(option.value)}
              onSelect={() => onToggleArray("security", option.value)}
            />
          ))}
        </div>
      </div>

      <hr className="section-divider" />

      <div className={`form-group ${validationFieldId === "deploy-test-section" ? "validation-target" : ""}`} id="deploy-test-section">
        <label className="field-label">테스트/검증 환경이 필요하신가요?</label>
        <div className="choice-grid cols-2">
          {testOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.test === option.value}
              onSelect={() => onFieldChange("test", option.value)}
            />
          ))}
        </div>
      </div>

      <div className={`form-group ${validationFieldId === "deploy-timeline-section" ? "validation-target" : ""}`} id="deploy-timeline-section">
        <label className="field-label">희망 일정</label>
        <div className="choice-grid cols-3">
          {timelineOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.timeline === option.value}
              onSelect={() => onFieldChange("timeline", option.value)}
            />
          ))}
        </div>
      </div>

      <div className={`form-group ${validationFieldId === "deploy-devexist-section" ? "validation-target" : ""}`} id="deploy-devexist-section">
        <label className="field-label">개발자 보유 여부</label>
        <div className="choice-grid cols-3">
          {devExistOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.devExist === option.value}
              onSelect={() => onFieldChange("devExist", option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
