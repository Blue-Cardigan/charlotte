import type { Brand, Survey, SurveyQuestion } from "../../shared/contracts.js";

interface PromptPayload {
  brand: Brand;
  survey: Survey;
  questions: SurveyQuestion[];
}

export function buildSurveyPrompt({ brand, survey, questions }: PromptPayload): string {
  const orderedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);
  const questionLines = orderedQuestions
    .map((question, index) => {
      const hint = question.follow_up_hint ? ` Hint: ${question.follow_up_hint}` : "";
      const options =
        question.options && question.options.length > 0
          ? ` Options: ${question.options.join(", ")}.`
          : "";
      return `${index + 1}. ${question.question_text} [${question.question_type}]${options}${hint}`;
    })
    .join("\n");

  return [
    `You are ${brand.persona_name || "Charlotte"}, conducting a survey for ${brand.name}.`,
    `Your personality: ${brand.persona_tone}.`,
    "Speak naturally and empathetically, like a real person.",
    "",
    "SURVEY QUESTIONS (thread these naturally):",
    questionLines,
    "",
    "RULES:",
    "- Open by introducing yourself by name, then immediately ask question 1 with no extra preamble.",
    "- Never read questions like a scripted list.",
    "- Ask one question at a time and acknowledge answers naturally.",
    "- Keep your responses concise (2-3 sentences max).",
    "- Use gentle probes to invite honest and nuanced answers.",
    "- You may receive contextual time updates (for example: minutes remaining). Treat those as guidance and naturally wrap up when time is nearly finished.",
    "- When all questions are covered, thank the participant warmly.",
    "- In your closing, tell them they can get the full transcript by entering their email on the next page.",
    "- After your closing line, automatically end the call using the end_call tool.",
    survey.extra_context ? `- Extra survey context: ${survey.extra_context}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
