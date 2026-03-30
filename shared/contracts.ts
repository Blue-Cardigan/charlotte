export type QuestionType = "open_ended" | "rating" | "multiple_choice" | "yes_no";

export type Role = "super_admin" | "brand_admin";

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  color_primary: string;
  color_secondary: string | null;
  color_accent: string;
  color_background: string;
  persona_name: string;
  persona_tone: string;
  voice_id: string | null;
  welcome_heading: string | null;
  welcome_body: string | null;
  created_at: string;
}

export interface Survey {
  id: string;
  brand_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "closed";
  duration_minutes: number;
  extra_context: string | null;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  order_index: number;
  required: boolean;
  follow_up_hint: string | null;
  created_at: string;
}

export interface SurveySession {
  id: string;
  survey_id: string;
  elevenlabs_conversation_id: string | null;
  transcript: unknown;
  source: string | null;
  referrer: string | null;
  landing_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  started_at: string;
  completed_at: string | null;
  respondent_email: string | null;
}

export interface SurveyResponse {
  id: string;
  session_id: string;
  question_id: string;
  raw_excerpt: string | null;
  extracted_answer: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  created_at: string;
}

export interface SurveyBundle {
  brand: Brand;
  survey: Survey;
  questions: SurveyQuestion[];
}

export interface AdminIdentity {
  id: string;
  email: string;
  brand_id: string | null;
  role: Role;
}
