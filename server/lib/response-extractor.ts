import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SurveyQuestion } from "../../shared/contracts";
import { env } from "./config";

const genAI = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY);

interface ExtractedAnswer {
  question_id: string;
  extracted_answer: string;
  raw_excerpt: string;
  sentiment: "positive" | "neutral" | "negative";
}

interface ExtractResponse {
  answers: ExtractedAnswer[];
}

function safeParseExtractResponse(payload: string): ExtractResponse {
  const parsed = JSON.parse(payload) as Partial<ExtractResponse>;
  if (!parsed.answers || !Array.isArray(parsed.answers)) {
    return { answers: [] };
  }

  return {
    answers: parsed.answers.flatMap((answer) => {
      if (
        typeof answer.question_id !== "string" ||
        typeof answer.extracted_answer !== "string" ||
        typeof answer.raw_excerpt !== "string" ||
        (answer.sentiment !== "positive" &&
          answer.sentiment !== "neutral" &&
          answer.sentiment !== "negative")
      ) {
        return [];
      }
      return [answer];
    }),
  };
}

export async function extractStructuredAnswers(params: {
  questions: SurveyQuestion[];
  transcript: unknown;
}): Promise<ExtractResponse> {
  const { questions, transcript } = params;
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
Extract answers for each survey question from this transcript.
Return strict JSON only with this shape:
{
  "answers": [
    {
      "question_id": "uuid",
      "extracted_answer": "clear answer",
      "raw_excerpt": "quote from transcript",
      "sentiment": "positive|neutral|negative"
    }
  ]
}

Questions:
${JSON.stringify(
    questions.map((q) => ({
      question_id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
    })),
    null,
    2,
  )}

Transcript:
${JSON.stringify(transcript, null, 2)}
`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return safeParseExtractResponse(cleaned);
}
