import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import { env } from "../lib/config";
import {
  createLocalBypassToken,
  getBypassCookieName,
  isLocalRequest,
} from "../lib/local-bypass-auth";
import { anonSupabase } from "../lib/supabase";

const magicLinkSchema = z.object({
  email: z.string().email(),
});

const authApp = new Hono<{ Variables: AuthVariables }>();

authApp.post("/magic-link", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = magicLinkSchema.safeParse(body);
  const isLocal = isLocalRequest(c.req.header("host"), c.req.header("origin"));

  if (!parsed.success) {
    const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
    if (env.DEV_BYPASS_EMAIL_GATE && isLocal && adminEmail) {
      const bypassToken = createLocalBypassToken(adminEmail, env.ADMIN_BOOTSTRAP_SECRET);
      setCookie(c, getBypassCookieName(), bypassToken, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 60 * 60 * 12,
      });
      return c.json({ ok: true, bypass: true });
    }
    return c.json({ error: "Invalid email address." }, 400);
  }

  const email = parsed.data.email.toLowerCase();
  const adminCheck = await anonSupabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const allowedByList = Boolean(adminCheck.data);
  const allowedByFallback = env.ADMIN_EMAIL?.toLowerCase() === email;
  const bypassAllowedForEmail = Boolean(
    env.DEV_BYPASS_EMAIL_GATE && isLocal && allowedByFallback,
  );

  if (!allowedByList && !allowedByFallback) {
    return c.json({ error: "Email is not authorized for admin access." }, 403);
  }

  if (bypassAllowedForEmail) {
    const bypassToken = createLocalBypassToken(email, env.ADMIN_BOOTSTRAP_SECRET);
    setCookie(c, getBypassCookieName(), bypassToken, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 12,
    });
    return c.json({ ok: true, bypass: true });
  }

  const signInResult = await anonSupabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.APP_URL}/admin`,
    },
  });

  if (signInResult.error) {
    return c.json({ error: signInResult.error.message }, 500);
  }

  return c.json({ ok: true });
});

authApp.post("/local-bypass", async (c) => {
  const isLocal = isLocalRequest(c.req.header("host"), c.req.header("origin"));
  if (!isLocal || !env.DEV_BYPASS_EMAIL_GATE) {
    return c.json({ error: "Local bypass is not enabled." }, 403);
  }

  const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) {
    return c.json({ error: "ADMIN_EMAIL is not configured." }, 500);
  }

  const bypassToken = createLocalBypassToken(adminEmail, env.ADMIN_BOOTSTRAP_SECRET);
  setCookie(c, getBypassCookieName(), bypassToken, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 12,
  });

  return c.json({ ok: true, bypass: true, email: adminEmail });
});

authApp.get("/me", requireAdmin, async (c) => {
  const admin = c.get("admin");
  return c.json(admin);
});

authApp.post("/logout", async (c) => {
  deleteCookie(c, getBypassCookieName(), { path: "/" });
  return c.json({ ok: true });
});

export { authApp };
