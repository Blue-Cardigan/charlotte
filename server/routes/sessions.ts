import { Hono } from "hono";
import { z } from "zod";
import { Resend } from "resend";
import { extractStructuredAnswers } from "../lib/response-extractor";
import { env } from "../lib/config";
import { serviceSupabase } from "../lib/supabase";

const resend = new Resend(env.RESEND_API_KEY);
const sessionsApp = new Hono();

sessionsApp.post("/:id/complete", async (c) => {
  const sessionId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({
      transcript: z.unknown(),
      elevenlabs_conversation_id: z.string().optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const updateResult = await serviceSupabase
    .from("survey_sessions")
    .update({
      transcript: parsed.data.transcript,
      elevenlabs_conversation_id: parsed.data.elevenlabs_conversation_id ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("id, survey_id, transcript")
    .single();

  if (updateResult.error || !updateResult.data) {
    return c.json({ error: updateResult.error?.message ?? "Session not found" }, 500);
  }

  const questionsResult = await serviceSupabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", updateResult.data.survey_id)
    .order("order_index", { ascending: true });

  if (questionsResult.error) {
    return c.json({ error: questionsResult.error.message }, 500);
  }

  const extraction = await extractStructuredAnswers({
    questions: questionsResult.data ?? [],
    transcript: updateResult.data.transcript,
  });

  if (extraction.answers.length > 0) {
    await serviceSupabase.from("survey_responses").delete().eq("session_id", sessionId);
    const rows = extraction.answers.map((answer) => ({
      session_id: sessionId,
      question_id: answer.question_id,
      raw_excerpt: answer.raw_excerpt,
      extracted_answer: answer.extracted_answer,
      sentiment: answer.sentiment,
    }));
    const insertResult = await serviceSupabase.from("survey_responses").insert(rows);
    if (insertResult.error) {
      return c.json({ error: insertResult.error.message }, 500);
    }
  }

  return c.json({ ok: true, answerCount: extraction.answers.length });
});

sessionsApp.post("/:id/email", async (c) => {
  const sessionId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({
      email: z.string().email(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const sessionResult = await serviceSupabase
    .from("survey_sessions")
    .update({ respondent_email: parsed.data.email })
    .eq("id", sessionId)
    .select("id, survey_id")
    .single();

  if (sessionResult.error || !sessionResult.data) {
    return c.json({ error: sessionResult.error?.message ?? "Session not found" }, 500);
  }

  const [surveyResult, responseResult] = await Promise.all([
    serviceSupabase.from("surveys").select("title").eq("id", sessionResult.data.survey_id).single(),
    serviceSupabase
      .from("survey_responses")
      .select("extracted_answer, sentiment, survey_questions(question_text)")
      .eq("session_id", sessionId),
  ]);

  if (surveyResult.error || responseResult.error) {
    return c.json({ error: surveyResult.error?.message ?? responseResult.error?.message }, 500);
  }

  const lines = (responseResult.data ?? []).map((row, index) => {
    const relation = row.survey_questions as
      | { question_text: string }
      | { question_text: string }[]
      | null;
    const question = Array.isArray(relation)
      ? (relation[0]?.question_text ?? "Question")
      : (relation?.question_text ?? "Question");
    return `${index + 1}. ${question}\nAnswer: ${row.extracted_answer ?? "No answer"}\nSentiment: ${
      row.sentiment ?? "n/a"
    }`;
  });

  const emailResult = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: parsed.data.email,
    subject: `Your responses - ${surveyResult.data?.title ?? "Survey"}`,
    text: `Thanks for taking part.\n\n${lines.join("\n\n")}`,
  });

  if (emailResult.error) {
    return c.json({ error: emailResult.error.message }, 500);
  }

  return c.json({ ok: true });
});

sessionsApp.get("/", async (c) => {
  const surveyId = c.req.query("survey_id");
  if (!surveyId) {
    return c.json({ error: "survey_id is required" }, 400);
  }
  const result = await serviceSupabase
    .from("survey_sessions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("started_at", { ascending: false });
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data ?? []);
});

export { sessionsApp };
