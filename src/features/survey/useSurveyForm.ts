import { useEffect, useMemo, useState } from "react";
import {
  AUTH_LABELS,
  AUTO_LABELS,
  FEATURE_LABELS,
  INITIAL_FORM_DATA,
  LABELS,
  NOTIF_LABELS,
  SEC_LABELS,
  STEP_TITLES,
  TOOL_LABELS,
  TOTAL_STEPS,
} from "./constants";
import { buildRecommendationMarkdown } from "./fallbackRecommendation";
import { recommendationService } from "./recommendationService";
import {
  StructuredRecommendation,
  SurveyFormData,
  SurveySummaryRow,
} from "./types";

type ArrayField =
  | "features"
  | "authTypes"
  | "notifChannels"
  | "automation"
  | "tools"
  | "security";

interface ValidationIssue {
  step: number;
  fieldId: string;
  message: string;
}

function isBlank(value: string) {
  return !value.trim();
}

function scrollToField(fieldId: string, delay = 0) {
  window.setTimeout(() => {
    const target = document.getElementById(fieldId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, delay);
}

function scrollToSectionTop(fieldId: string, delay = 0) {
  window.setTimeout(() => {
    const target = document.getElementById(fieldId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, delay);
}

function validateStep(step: number, data: SurveyFormData): ValidationIssue | null {
  switch (step) {
    case 1:
      if (isBlank(data.serviceName)) {
        return {
          step,
          fieldId: "service-name-section",
          message: "서비스 이름 또는 프로젝트명을 먼저 입력해 주세요.",
        };
      }
      if (isBlank(data.serviceDesc)) {
        return {
          step,
          fieldId: "service-desc-section",
          message: "서비스 설명을 작성해 주세요.",
        };
      }
      if (!data.features.length) {
        return {
          step,
          fieldId: "service-features-section",
          message: "주요 기능을 하나 이상 선택해 주세요.",
        };
      }
      return null;
    case 2:
      if (!data.env) {
        return {
          step,
          fieldId: "environment-env-section",
          message: "서비스 실행 환경을 선택해 주세요.",
        };
      }
      if (!data.users) {
        return {
          step,
          fieldId: "environment-users-section",
          message: "사용 인원 규모를 선택해 주세요.",
        };
      }
      if (!data.os) {
        return {
          step,
          fieldId: "environment-os-section",
          message: "개발에 사용할 운영체제를 선택해 주세요.",
        };
      }
      return null;
    case 3:
      if (!data.db) {
        return {
          step,
          fieldId: "data-db-section",
          message: "데이터 저장 필요 여부를 선택해 주세요.",
        };
      }
      if (data.db === "yes" && !data.dbExist) {
        return {
          step,
          fieldId: "data-db-exist-section",
          message: "기존 데이터베이스 사용 여부를 선택해 주세요.",
        };
      }
      if (data.db === "yes" && !data.dbType) {
        return {
          step,
          fieldId: "data-db-type-section",
          message: "사용할 데이터베이스를 선택해 주세요.",
        };
      }
      if (!data.auth) {
        return {
          step,
          fieldId: "data-auth-section",
          message: "로그인 기능 필요 여부를 선택해 주세요.",
        };
      }
      if (data.auth === "yes" && !data.authTypes.length) {
        return {
          step,
          fieldId: "data-auth-types-section",
          message: "로그인 방식을 하나 이상 선택해 주세요.",
        };
      }
      return null;
    case 4:
      if (!data.notif) {
        return {
          step,
          fieldId: "automation-notif-section",
          message: "알림 기능 필요 여부를 선택해 주세요.",
        };
      }
      if (data.notif === "yes" && !data.notifChannels.length) {
        return {
          step,
          fieldId: "automation-notif-channels-section",
          message: "알림 채널을 하나 이상 선택해 주세요.",
        };
      }
      if (!data.automation.length) {
        return {
          step,
          fieldId: "automation-tasks-section",
          message: "자동화가 필요한 작업을 하나 이상 선택해 주세요.",
        };
      }
      return null;
    case 5:
      if (!data.aiAgent) {
        return {
          step,
          fieldId: "tools-ai-agent-section",
          message: "사용하려는 AI Agent를 선택해 주세요.",
        };
      }
      if (!data.tools.length) {
        return {
          step,
          fieldId: "tools-collab-section",
          message: "협업 또는 관리 도구를 하나 이상 선택해 주세요.",
        };
      }
      if (!data.git) {
        return {
          step,
          fieldId: "tools-git-section",
          message: "버전 관리 사용 여부를 선택해 주세요.",
        };
      }
      return null;
    case 6:
      if (!data.deploy) {
        return {
          step,
          fieldId: "deploy-target-section",
          message: "배포 환경을 선택해 주세요.",
        };
      }
      if (!data.security.length) {
        return {
          step,
          fieldId: "deploy-security-section",
          message: "보안 요구사항을 하나 이상 선택해 주세요.",
        };
      }
      if (!data.test) {
        return {
          step,
          fieldId: "deploy-test-section",
          message: "테스트 환경 필요 여부를 선택해 주세요.",
        };
      }
      if (!data.timeline) {
        return {
          step,
          fieldId: "deploy-timeline-section",
          message: "예상 일정 또는 마감을 선택해 주세요.",
        };
      }
      if (!data.devExist) {
        return {
          step,
          fieldId: "deploy-devexist-section",
          message: "개발자 보유 여부를 선택해 주세요.",
        };
      }
      return null;
    default:
      return null;
  }
}

export function useSurveyForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SurveyFormData>(INITIAL_FORM_DATA);
  const [result, setResult] = useState<StructuredRecommendation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationIssue, setValidationIssue] = useState<ValidationIssue | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== TOTAL_STEPS) return;
    if (!isSubmitting && !result) return;

    scrollToSectionTop("recommendation-report-top", 120);
  }, [currentStep, isSubmitting, result]);

  const summaryRows = useMemo<SurveySummaryRow[]>(() => {
    const data = formData;
    return [
      { icon: "🏷️", label: "서비스명", value: data.serviceName || "(미입력)" },
      {
        icon: "📝",
        label: "서비스 설명",
        value:
          data.serviceDesc.length > 80
            ? `${data.serviceDesc.slice(0, 80)}...`
            : data.serviceDesc || "(미입력)",
      },
      {
        icon: "⚙️",
        label: "주요 기능",
        value: data.features.map((item) => FEATURE_LABELS[item] || item).join(" · ") || "(미선택)",
      },
      { icon: "🖥️", label: "실행 환경", value: LABELS.env[data.env as keyof typeof LABELS.env] || "(미선택)" },
      { icon: "👥", label: "사용 인원", value: LABELS.users[data.users as keyof typeof LABELS.users] || "(미선택)" },
      { icon: "💻", label: "OS 환경", value: LABELS.os[data.os as keyof typeof LABELS.os] || "(미선택)" },
      {
        icon: "💾",
        label: "데이터 저장",
        value:
          (LABELS.db[data.db as keyof typeof LABELS.db] || "(미선택)") +
          (data.dbType ? ` — ${LABELS.dbType[data.dbType as keyof typeof LABELS.dbType] || data.dbType}` : ""),
      },
      { icon: "🔗", label: "기존 DB", value: data.db === "no" ? "해당 없음" : data.dbExist === "yes" ? "보유" : data.dbExist === "no" ? "신규 구축" : "(미선택)" },
      {
        icon: "🔐",
        label: "로그인",
        value:
          (LABELS.auth[data.auth as keyof typeof LABELS.auth] || "(미선택)") +
          (data.authTypes.length
            ? ` (${data.authTypes.map((item) => AUTH_LABELS[item] || item).join(", ")})`
            : ""),
      },
      {
        icon: "🔔",
        label: "알림 채널",
        value: data.notif
          ? data.notifChannels.map((item) => NOTIF_LABELS[item] || item).join(" · ") || "없음"
          : "(미선택)",
      },
      { icon: "🔔", label: "알림 사용", value: LABELS.notif[data.notif as keyof typeof LABELS.notif] || "(미선택)" },
      {
        icon: "⚙️",
        label: "자동화",
        value: data.automation.map((item) => AUTO_LABELS[item] || item).join(" · ") || "(미선택)",
      },
      {
        icon: "🤖",
        label: "AI Agent",
        value: LABELS.aiAgent[data.aiAgent as keyof typeof LABELS.aiAgent] || "(미선택)",
      },
      {
        icon: "🛠️",
        label: "협업 도구",
        value: data.tools.map((item) => TOOL_LABELS[item] || item).join(" · ") || "(미선택)",
      },
      { icon: "🌿", label: "Git", value: LABELS.git[data.git as keyof typeof LABELS.git] || "(미선택)" },
      {
        icon: "🚀",
        label: "배포 환경",
        value: LABELS.deploy[data.deploy as keyof typeof LABELS.deploy] || "(미선택)",
      },
      {
        icon: "🛡️",
        label: "보안 요구",
        value: data.security.map((item) => SEC_LABELS[item] || item).join(" · ") || "(미선택)",
      },
      { icon: "🧪", label: "테스트 환경", value: LABELS.test[data.test as keyof typeof LABELS.test] || "(미선택)" },
      {
        icon: "⏱️",
        label: "일정",
        value: LABELS.timeline[data.timeline as keyof typeof LABELS.timeline] || "(미선택)",
      },
      { icon: "👨‍💻", label: "개발 방식", value: LABELS.devExist[data.devExist as keyof typeof LABELS.devExist] || "(미선택)" },
      { icon: "🗒️", label: "추가 조건", value: data.deploy ? data.extraNote || "없음" : "(미선택)" },
    ];
  }, [formData]);

  function updateField<K extends keyof SurveyFormData>(field: K, value: SurveyFormData[K]) {
    setValidationIssue(null);
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function toggleArrayValue(field: ArrayField, value: string) {
    setValidationIssue(null);
    setFormData((current) => {
      const currentValues = current[field];
      let nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      if (value === "none" && !currentValues.includes(value)) {
        nextValues = ["none"];
      }

      if (value !== "none" && !currentValues.includes(value)) {
        nextValues = nextValues.filter((item) => item !== "none");
      }

      return { ...current, [field]: nextValues };
    });
  }

  function nextStep() {
    const issue = validateStep(currentStep, formData);
    if (issue) {
      setValidationIssue(issue);
      scrollToField(issue.fieldId);
      return;
    }

    setValidationIssue(null);
    setCurrentStep((step) => Math.min(step + 1, TOTAL_STEPS));
  }

  function prevStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function goToStep(step: number) {
    if (step > currentStep) {
      for (let candidateStep = 1; candidateStep < step; candidateStep += 1) {
        const issue = validateStep(candidateStep, formData);
        if (issue) {
          setValidationIssue(issue);
          setCurrentStep(issue.step);
          scrollToField(issue.fieldId, 120);
          return;
        }
      }
    }

    setValidationIssue(null);
    setCurrentStep(Math.max(0, Math.min(step, TOTAL_STEPS)));
  }

  async function submit() {
    for (let step = 1; step < TOTAL_STEPS; step += 1) {
      const issue = validateStep(step, formData);
      if (issue) {
        setValidationIssue(issue);
        setCurrentStep(issue.step);
        scrollToField(issue.fieldId, 120);
        return;
      }
    }

    setValidationIssue(null);
    setResult(null);
    setIsSubmitting(true);
    try {
      const nextResult = await recommendationService.generate(formData);
      setResult(nextResult);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(buildRecommendationMarkdown(result));
  }

  function downloadMarkdown() {
    if (!result) return;
    const markdown = buildRecommendationMarkdown(result);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formData.serviceName || "agent-blueprint-result"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFormData(INITIAL_FORM_DATA);
    setCurrentStep(0);
    setResult(null);
  }

  return {
    currentStep,
    formData,
    isSubmitting,
    result,
    validationIssue,
    stepTitle: STEP_TITLES[currentStep],
    summaryRows,
    totalSteps: TOTAL_STEPS,
    updateField,
    toggleArrayValue,
    nextStep,
    prevStep,
    goToStep,
    submit,
    copyResult,
    downloadMarkdown,
    reset,
  };
}
