import { StructuredRecommendation, SurveyFormData } from "../survey/types";

export interface UploadedReferenceDocument {
  fileName: string;
  fileType: string;
  status: "ready" | "unsupported" | "error";
  extractedText: string;
  message: string;
}

export interface PrdGenerationContext {
  formData: SurveyFormData;
  recommendation: StructuredRecommendation;
}

export interface PrdFormData {
  documentTitle: string;
  projectOverview: string;
  problemStatement: string;
  goals: string;
  targetUsers: string;
  userScenarios: string;
  functionalRequirements: string;
  outOfScope: string;
  dataAndIntegrations: string;
  constraints: string;
  successMetrics: string;
  releasePlan: string;
  additionalNotes: string;
}

export interface StructuredPrd {
  title: string;
  summary: string;
  prdMarkdown: string;
}

export interface PrdGenerationInput {
  context: PrdGenerationContext;
  formData: PrdFormData;
  uploadedDocuments: UploadedReferenceDocument[];
  guideDocuments: {
    title: string;
    content: string;
    path: string;
  }[];
}
