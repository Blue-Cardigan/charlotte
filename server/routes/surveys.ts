import { Hono } from "hono";
import { z } from "zod";
import type { SurveyBundle } from "../../shared/contracts.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { serviceSupabase } from "../lib/supabase.js";

const surveySchema = z.object({
  brand_id: z.string().uuid(),
  title: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "closed"]).default("draft"),
  extra_context: z.string().nullable().optional(),
});

const surveysApp = new Hono<{ Variables: AuthVariables }>();

surveysApp.get("/by-slug/:slug", async (c) => {
  const slug = c.req.param("slug");
  const surveyResult = await serviceSupabase
    .from("surveys")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (surveyResult.error) {
    return c.json({ error: surveyResult.error.message }, 500);
  }
  if (!surveyResult.data) {
    return c.json({ error: "Survey not found." }, 404);
  }

  const [brandResult, questionsResult] = await Promise.all([
    serviceSupabase.from("brands").select("*").eq("id", surveyResult.data.brand_id).single(),
    serviceSupabase
      .from("survey_questions")
      .select("*")
      .eq("survey_id", surveyResult.data.id)
      .order("order_index", { ascending: true }),
  ]);

  if (brandResult.error || questionsResult.error) {
    return c.json({ error: brandResult.error?.message ?? questionsResult.error?.message }, 500);
  }

  const payload: SurveyBundle = {
    brand: brandResult.data,
    survey: surveyResult.data,
    questions: questionsResult.data ?? [],
  };
  return c.json(payload);
});

surveysApp.use("*", async (c, next) => requireAdmin(c, next));

surveysApp.get("/", async (c) => {
  const admin = c.get("admin");
  const query = serviceSupabase
    .from("surveys")
    .select("*, brands!inner(id, name)")
    .order("created_at", { ascending: false });
  if (admin.role === "brand_admin" && admin.brand_id) {
    query.eq("brand_id", admin.brand_id);
  }
  const result = await query;
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data ?? []);
});

surveysApp.post("/", async (c) => {
  const admin = c.get("admin");
  const body = await c.req.json().catch(() => ({}));
  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  if (admin.role === "brand_admin" && admin.brand_id !== parsed.data.brand_id) {
    return c.json({ error: "Cannot create survey for another brand." }, 403);
  }
  const result = await serviceSupabase.from("surveys").insert(parsed.data).select("*").single();
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data, 201);
});

surveysApp.patch("/:id", async (c) => {
  const surveyId = c.req.param("id");
  const admin = c.get("admin");
  const body = await c.req.json().catch(() => ({}));
  const parsed = surveySchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await serviceSupabase.from("surveys").select("id, brand_id").eq("id", surveyId).single();
  if (existing.error) {
    return c.json({ error: existing.error.message }, 500);
  }
  if (admin.role === "brand_admin" && admin.brand_id !== existing.data.brand_id) {
    return c.json({ error: "Cannot edit another brand survey." }, 403);
  }

  const result = await serviceSupabase
    .from("surveys")
    .update(parsed.data)
    .eq("id", surveyId)
    .select("*")
    .single();
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data);
});

export { surveysApp };
