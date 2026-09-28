export type SurveyStepId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SurveyFormData {
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
}

export interface SurveySummaryRow {
  icon: string;
  label: string;
  value: string;
}

export type GuideDocKey = string;

export interface StructuredRecommendation {
  title: string;
  summary: string;
  reportMarkdown: string;
  guideDocs: GuideDocKey[];
}

export interface RecommendationService {
  generate(data: SurveyFormData): Promise<StructuredRecommendation>;
}

export interface ChoiceOption {
  value: string;
  icon: string;
  title: string;
  description: string;
}
