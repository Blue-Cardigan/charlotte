import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { serviceSupabase } from "../lib/supabase.js";

const responsesApp = new Hono<{ Variables: AuthVariables }>();
responsesApp.use("*", requireAdmin);

responsesApp.get("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const result = await serviceSupabase
    .from("survey_responses")
    .select("*, survey_questions(question_text)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data ?? []);
});

export { responsesApp };
