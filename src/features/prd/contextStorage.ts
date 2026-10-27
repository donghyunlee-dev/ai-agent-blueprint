interface PrdGenerationContext {
  formData: {
    serviceName: string;
    serviceDesc: string;
    features: string[];
    env: string;
    users: string;
    os: string;
    db: string;
    dbExist: string;
    dbType: string;
    auth: string;
    authTypes: string[];
    notif: string;
    notifChannels: string[];
    automation: string[];
    aiAgent: string;
    tools: string[];
    git: string;
    deploy: string;
    security: string[];
    test: string;
    timeline: string;
    devExist: string;
    extraNote: string;
  };
  recommendation: {
    title: string;
    summary: string;
    reportMarkdown: string;
    guideDocs: string[];
  };
}

const STORAGE_KEY = "windsoft-agent-blueprint:prd-context";
const LEGACY_STORAGE_KEY = "sfood-agent-blueprint:prd-context";

export function savePrdContext(context: PrdGenerationContext) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export function clearPrdContext() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function loadPrdContext(): PrdGenerationContext | null {
  const current = sessionStorage.getItem(STORAGE_KEY);
  if (current !== null) {
    const context = parseContext(current);
    if (context) {
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      return context;
    }
  }

  const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return null;

  const context = parseContext(legacy);
  if (!context) {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    return null;
  }

  if (current !== null) return context;

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  return context;
}

function parseContext(raw: string): PrdGenerationContext | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value.formData) || !isRecord(value.recommendation)) {
      return null;
    }

    const formData = value.formData;
    const formDataFields = [
      "serviceName", "serviceDesc", "env", "users", "os", "db", "dbExist", "dbType",
      "auth", "notif", "aiAgent", "git", "deploy", "test", "timeline", "devExist", "extraNote",
    ];
    const formDataArrayFields = [
      "features", "authTypes", "notifChannels", "automation", "tools", "security",
    ];
    const recommendation = value.recommendation;

    if (
      !formDataFields.every((field) => typeof formData[field] === "string") ||
      !formDataArrayFields.every((field) =>
        Array.isArray(formData[field]) && formData[field].every((item) => typeof item === "string"),
      ) ||
      typeof recommendation.title !== "string" ||
      typeof recommendation.summary !== "string" ||
      typeof recommendation.reportMarkdown !== "string" ||
      !Array.isArray(recommendation.guideDocs) ||
      !recommendation.guideDocs.every((item) => typeof item === "string")
    ) {
      return null;
    }

    return value as unknown as PrdGenerationContext;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (typeof window !== "undefined") {
  window.addEventListener("blueprint:clear-session-state", clearPrdContext);
}
