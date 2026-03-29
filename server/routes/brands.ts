import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { serviceSupabase } from "../lib/supabase.js";

const brandInputSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  logo_url: z.string().url().nullable().optional(),
  color_primary: z.string().min(4),
  color_secondary: z.string().nullable().optional(),
  color_accent: z.string().min(4),
  color_background: z.string().min(4),
  persona_name: z.string().min(2),
  persona_tone: z.string().min(4),
  voice_id: z.string().nullable().optional(),
  welcome_heading: z.string().nullable().optional(),
  welcome_body: z.string().nullable().optional(),
});

const brandsApp = new Hono<{ Variables: AuthVariables }>();
brandsApp.use("*", requireAdmin);

brandsApp.get("/", async (c) => {
  const admin = c.get("admin");
  const query = serviceSupabase.from("brands").select("*").order("created_at", { ascending: false });
  if (admin.role === "brand_admin" && admin.brand_id) {
    query.eq("id", admin.brand_id);
  }
  const result = await query;
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data ?? []);
});

brandsApp.post("/", async (c) => {
  const admin = c.get("admin");
  if (admin.role !== "super_admin") {
    return c.json({ error: "Only super admins can create brands." }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = brandInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const result = await serviceSupabase.from("brands").insert(parsed.data).select("*").single();
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data, 201);
});

brandsApp.patch("/:id", async (c) => {
  const admin = c.get("admin");
  const brandId = c.req.param("id");
  if (admin.role === "brand_admin" && admin.brand_id !== brandId) {
    return c.json({ error: "Cannot edit another brand." }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = brandInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const result = await serviceSupabase
    .from("brands")
    .update(parsed.data)
    .eq("id", brandId)
    .select("*")
    .single();
  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json(result.data);
});

export { brandsApp };
