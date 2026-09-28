import { aiAgentOptions, gitOptions, toolOptions } from "../../../features/survey/constants";
import { SurveyFormData } from "../../../features/survey/types";
import { ChoiceCard } from "../ChoiceCard";

interface ToolsStepProps {
  formData: SurveyFormData;
  validationFieldId: string | null;
  validationMessage: string | null;
  onFieldChange: <K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) => void;
  onToggleArray: (field: "tools", value: string) => void;
}

export function ToolsStep({ formData, validationFieldId, validationMessage, onFieldChange, onToggleArray }: ToolsStepProps) {
  return (
    <div className="step-card active">
      <h2>🧰 AI·업무 도구</h2>
      <p className="desc">AI 에이전트와 함께 사용할 도구와 협업 도구를 선택해 주세요.</p>

      {validationMessage ? <div className="validation-banner" role="alert">{validationMessage}</div> : null}

      <div className={`form-group ${validationFieldId === "tools-ai-agent-section" ? "validation-target" : ""}`} id="tools-ai-agent-section">
        <label className="field-label">사용하려는 AI Agent는 무엇인가요? <span className="required">*</span></label>
        <div className="choice-grid cols-2">
          {aiAgentOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.aiAgent === option.value}
              onSelect={() => onFieldChange("aiAgent", option.value)}
            />
          ))}
        </div>
      </div>

      <hr className="section-divider" />

      <div className={`form-group ${validationFieldId === "tools-collab-section" ? "validation-target" : ""}`} id="tools-collab-section">
        <label className="field-label">현재 사용 중이거나 사용할 업무·협업 도구 (복수 선택 가능)</label>
        <div className="choice-grid cols-3">
          {toolOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="checkbox"
              selected={formData.tools.includes(option.value)}
              onSelect={() => onToggleArray("tools", option.value)}
            />
          ))}
        </div>
      </div>

      <hr className="section-divider" />

      <div className={`form-group ${validationFieldId === "tools-git-section" ? "validation-target" : ""}`} id="tools-git-section">
        <label className="field-label">코드 버전 관리를 쓰고 계신가요?</label>
        <div className="choice-grid cols-3">
          {gitOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.git === option.value}
              onSelect={() => onFieldChange("git", option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
