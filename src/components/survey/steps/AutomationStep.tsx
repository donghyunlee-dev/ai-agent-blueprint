import { automationOptions, notifChannelOptions, notifOptions } from "../../../features/survey/constants";
import { SurveyFormData } from "../../../features/survey/types";
import { ChoiceCard } from "../ChoiceCard";

interface AutomationStepProps {
  formData: SurveyFormData;
  validationFieldId: string | null;
  validationMessage: string | null;
  onFieldChange: <K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) => void;
  onToggleArray: (field: "notifChannels" | "automation", value: string) => void;
}

export function AutomationStep({ formData, validationFieldId, validationMessage, onFieldChange, onToggleArray }: AutomationStepProps) {
  return (
    <div className="step-card active">
      <h2>🔔 알림·자동화</h2>
      <p className="desc">알림이 필요한지, 반복 작업을 자동화할지 선택해 주세요.</p>

      {validationMessage ? <div className="validation-banner" role="alert">{validationMessage}</div> : null}

      <div className={`form-group ${validationFieldId === "automation-notif-section" ? "validation-target" : ""}`} id="automation-notif-section">
        <label className="field-label">알림 기능이 필요하신가요?</label>
        <div className="choice-grid cols-2">
          {notifOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.notif === option.value}
              onSelect={() => {
                onFieldChange("notif", option.value);
                if (option.value === "no") onFieldChange("notifChannels", []);
              }}
            />
          ))}
        </div>
      </div>

      {formData.notif === "yes" ? (
        <div className={`form-group ${validationFieldId === "automation-notif-channels-section" ? "validation-target" : ""}`} id="automation-notif-channels-section">
          <label className="field-label">알림 받을 채널 (복수 선택 가능)</label>
          <div className="choice-grid cols-3">
            {notifChannelOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                option={option}
                type="checkbox"
                selected={formData.notifChannels.includes(option.value)}
                onSelect={() => onToggleArray("notifChannels", option.value)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className={`form-group ${validationFieldId === "automation-tasks-section" ? "validation-target" : ""}`} id="automation-tasks-section">
        <label className="field-label">자동화 항목 (복수 선택 가능)</label>
        <div className="choice-grid cols-3">
          {automationOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="checkbox"
              selected={formData.automation.includes(option.value)}
              onSelect={() => onToggleArray("automation", option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
