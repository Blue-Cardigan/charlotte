import { Hono } from "hono";
import { z } from "zod";
import { buildSurveyPrompt } from "../lib/prompt-builder.js";
import { env } from "../lib/config.js";
import { serviceSupabase } from "../lib/supabase.js";

const signedUrlApp = new Hono();

signedUrlApp.get("/", async (c) => {
  const parsed = z
    .object({
      survey_id: z.string().uuid(),
      source: z.string().optional(),
      src: z.string().optional(),
      referrer: z.string().optional(),
      landing_path: z.string().optional(),
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
    })
    .safeParse(c.req.query());

  if (!parsed.success) {
    return c.json({ error: "Missing survey_id query param." }, 400);
  }

  const surveyId = parsed.data.survey_id;
  const source = parsed.data.source ?? parsed.data.src ?? parsed.data.utm_source ?? null;

  const [surveyResult, questionsResult] = await Promise.all([
    serviceSupabase.from("surveys").select("*").eq("id", surveyId).single(),
    serviceSupabase
      .from("survey_questions")
      .select("*")
      .eq("survey_id", surveyId)
      .order("order_index", { ascending: true }),
  ]);

  if (surveyResult.error || questionsResult.error || !surveyResult.data) {
    return c.json({ error: surveyResult.error?.message ?? questionsResult.error?.message }, 500);
  }

  const brandResult = await serviceSupabase
    .from("brands")
    .select("*")
    .eq("id", surveyResult.data.brand_id)
    .single();

  if (brandResult.error || !brandResult.data) {
    return c.json({ error: brandResult.error?.message ?? "Brand not found." }, 500);
  }

  const prompt = buildSurveyPrompt({
    brand: brandResult.data,
    survey: surveyResult.data,
    questions: questionsResult.data ?? [],
  });
  const personaName = brandResult.data.persona_name?.trim() || "Charlotte";
  const introLine = `Hey, I'm ${personaName}.`;
  const surveyTopic =
    brandResult.data.display_name?.trim() || surveyResult.data.title?.trim() || brandResult.data.name;
  const purposeLine = `I'm here to run a short survey about ${surveyTopic}.`;
  const firstQuestion = questionsResult.data?.[0]?.question_text?.trim();
  const welcomeBody = brandResult.data.welcome_body?.trim();
  const firstMessage = firstQuestion
    ? `${introLine} ${purposeLine} ${firstQuestion}`
    : welcomeBody
      ? `${introLine} ${purposeLine} ${welcomeBody}`
      : `${introLine} ${purposeLine}`;

  const elevenLabsAgentId = env.ELEVENLABS_AGENT_ID;
  if (!elevenLabsAgentId) {
    return c.json({ error: "ELEVENLABS_AGENT_ID missing in env." }, 500);
  }

  const signedUrlResponse = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(elevenLabsAgentId)}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
      },
    },
  );

  if (!signedUrlResponse.ok) {
    const details = await signedUrlResponse.text();
    return c.json({ error: `Failed to create signed url: ${details}` }, 500);
  }

  const signedUrlPayload = (await signedUrlResponse.json()) as { signed_url?: string };
  if (!signedUrlPayload.signed_url) {
    return c.json({ error: "ElevenLabs response missing signed_url" }, 500);
  }

  const sessionInsert = await serviceSupabase
    .from("survey_sessions")
    .insert({
      survey_id: surveyId,
      transcript: [],
      source,
      referrer: parsed.data.referrer ?? null,
      landing_path: parsed.data.landing_path ?? null,
      utm_source: parsed.data.utm_source ?? null,
      utm_medium: parsed.data.utm_medium ?? null,
      utm_campaign: parsed.data.utm_campaign ?? null,
      utm_content: parsed.data.utm_content ?? null,
      utm_term: parsed.data.utm_term ?? null,
    })
    .select("id")
    .single();

  if (sessionInsert.error) {
    return c.json({ error: sessionInsert.error.message }, 500);
  }

  return c.json({
    signedUrl: signedUrlPayload.signed_url,
    sessionId: sessionInsert.data.id,
    durationMinutes: surveyResult.data.duration_minutes ?? 10,
    overrides: {
      agent: {
        prompt: {
          prompt,
        },
        firstMessage,
      },
      tts: {
        voiceId: brandResult.data.voice_id ?? undefined,
        speed: 1.2,
      },
    },
  });
});

export { signedUrlApp };
