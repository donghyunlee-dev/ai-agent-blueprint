import { authOptions, authTypeOptions, dbExistOptions, dbOptions, dbTypeOptions } from "../../../features/survey/constants";
import { SurveyFormData } from "../../../features/survey/types";
import { ChoiceCard } from "../ChoiceCard";

interface DataStepProps {
  formData: SurveyFormData;
  validationFieldId: string | null;
  validationMessage: string | null;
  onFieldChange: <K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) => void;
  onToggleArray: (field: "authTypes", value: string) => void;
}

export function DataStep({ formData, validationFieldId, validationMessage, onFieldChange, onToggleArray }: DataStepProps) {
  return (
    <div className="step-card active">
      <h2>🔐 데이터·로그인 설정</h2>
      <p className="desc">데이터 저장/조회와 로그인 여부에 따라 필요한 기술 구성이 달라집니다.</p>

      {validationMessage ? <div className="validation-banner" role="alert">{validationMessage}</div> : null}

      <div className={`form-group ${validationFieldId === "data-db-section" ? "validation-target" : ""}`} id="data-db-section">
        <label className="field-label">데이터가 별도로 필요한가요? <span className="required">*</span></label>
        <div className="choice-grid cols-2">
          {dbOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.db === option.value}
              onSelect={() => {
                onFieldChange("db", option.value);
                if (option.value === "no") {
                  onFieldChange("dbExist", "");
                  onFieldChange("dbType", "");
                }
              }}
            />
          ))}
        </div>
      </div>

      {formData.db === "yes" ? (
        <div className="conditional show">
          <div className={`form-group ${validationFieldId === "data-db-exist-section" ? "validation-target" : ""}`} id="data-db-exist-section">
            <label className="field-label">기존 DB가 있나요?</label>
            <div className="choice-grid cols-2">
              {dbExistOptions.map((option) => (
                <ChoiceCard
                  key={option.value}
                  option={option}
                  type="radio"
                  selected={formData.dbExist === option.value}
                  onSelect={() => onFieldChange("dbExist", option.value)}
                />
              ))}
            </div>
          </div>

          <div className={`form-group ${validationFieldId === "data-db-type-section" ? "validation-target" : ""}`} id="data-db-type-section">
            <label className="field-label">데이터베이스 종류</label>
            <div className="choice-grid cols-3">
              {dbTypeOptions.map((option) => (
                <ChoiceCard
                  key={option.value}
                  option={option}
                  type="radio"
                  selected={formData.dbType === option.value}
                  onSelect={() => onFieldChange("dbType", option.value)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <hr className="section-divider" />

      <div className={`form-group ${validationFieldId === "data-auth-section" ? "validation-target" : ""}`} id="data-auth-section">
        <label className="field-label">로그인이 필요하신가요? <span className="required">*</span></label>
        <div className="choice-grid cols-2">
          {authOptions.map((option) => (
            <ChoiceCard
              key={option.value}
              option={option}
              type="radio"
              selected={formData.auth === option.value}
              onSelect={() => onFieldChange("auth", option.value)}
            />
          ))}
        </div>
      </div>

      {formData.auth === "yes" ? (
        <div className={`form-group ${validationFieldId === "data-auth-types-section" ? "validation-target" : ""}`} id="data-auth-types-section">
          <label className="field-label">로그인 방식 (복수 선택 가능)</label>
          <div className="choice-grid cols-3">
            {authTypeOptions.map((option) => (
              <ChoiceCard
                key={option.value}
                option={option}
                type="checkbox"
                selected={formData.authTypes.includes(option.value)}
                onSelect={() => onToggleArray("authTypes", option.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
