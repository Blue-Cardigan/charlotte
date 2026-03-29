import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { serviceSupabase } from "../lib/supabase.js";

const questionSchema = z.object({
  survey_id: z.string().uuid(),
  question_text: z.string().min(2),
  question_type: z.enum(["open_ended", "rating", "multiple_choice", "yes_no"]),
  options: z.array(z.string()).nullable().optional(),
  order_index: z.number().int().min(0),
  required: z.boolean().default(true),
  follow_up_hint: z.string().nullable().optional(),
});

const questionsApp = new Hono<{ Variables: AuthVariables }>();
questionsApp.use("*", requireAdmin);

questionsApp.get("/survey/:surveyId", async (c) => {
  const surveyId = c.req.param("surveyId");
  const result = await serviceSupabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true });
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data ?? []);
});

questionsApp.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const result = await serviceSupabase
    .from("survey_questions")
    .insert(parsed.data)
    .select("*")
    .single();
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data, 201);
});

questionsApp.patch("/:id", async (c) => {
  const questionId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = questionSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const result = await serviceSupabase
    .from("survey_questions")
    .update(parsed.data)
    .eq("id", questionId)
    .select("*")
    .single();
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data);
});

questionsApp.delete("/:id", async (c) => {
  const questionId = c.req.param("id");
  const result = await serviceSupabase.from("survey_questions").delete().eq("id", questionId);
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json({ ok: true });
});

questionsApp.post("/reorder", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({
      items: z.array(
        z.object({
          id: z.string().uuid(),
          order_index: z.number().int().min(0),
        }),
      ),
    })
    .safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const updates = parsed.data.items.map((item) =>
    serviceSupabase
      .from("survey_questions")
      .update({ order_index: item.order_index })
      .eq("id", item.id),
  );
  const results = await Promise.all(updates);
  const firstError = results.find((item) => item.error)?.error;
  if (firstError) {
    return c.json({ error: firstError.message }, 500);
  }
  return c.json({ ok: true });
});

export { questionsApp };
