import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AdminIdentity } from "../../shared/contracts.js";
import { env } from "../lib/config.js";
import {
  getBypassCookieName,
  isLocalRequest,
  verifyLocalBypassToken,
} from "../lib/local-bypass-auth.js";
import { serviceSupabase } from "../lib/supabase.js";

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) {
      return acc;
    }
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

export type AuthVariables = {
  admin: AdminIdentity;
  authToken: string;
};

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header("authorization");
  const cookieHeader = c.req.header("cookie");
  const cookieValues = parseCookieHeader(cookieHeader);
  const bypassToken = cookieValues[getBypassCookieName()];

  let email: string | null = null;
  let resolvedAuthToken = "";

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const userResult = await serviceSupabase.auth.getUser(token);
    const user = userResult.data.user;
    if (!user || !user.email) {
      throw new HTTPException(401, { message: "Invalid auth token" });
    }
    email = user.email.toLowerCase();
    resolvedAuthToken = token;
  } else if (bypassToken) {
    const isLocal = isLocalRequest(c.req.header("host"), c.req.header("origin"));
    if (!isLocal || !env.DEV_BYPASS_EMAIL_GATE) {
      throw new HTTPException(401, { message: "Bypass auth not available." });
    }
    email = verifyLocalBypassToken(bypassToken, env.ADMIN_BOOTSTRAP_SECRET);
    if (!email) {
      throw new HTTPException(401, { message: "Invalid bypass auth token." });
    }
    resolvedAuthToken = "local-bypass";
  } else {
    throw new HTTPException(401, { message: "Missing auth token" });
  }

  const adminQuery = await serviceSupabase
    .from("admin_users")
    .select("id, email, brand_id, role")
    .eq("email", email)
    .maybeSingle();

  if (adminQuery.error) {
    throw new HTTPException(500, { message: adminQuery.error.message });
  }

  const isFallbackAdmin = env.ADMIN_EMAIL?.toLowerCase() === email;
  if (!adminQuery.data && !isFallbackAdmin) {
    throw new HTTPException(403, { message: "Not an admin user" });
  }

  const admin: AdminIdentity = adminQuery.data ?? {
    id: "bootstrap-admin",
    email: email,
    brand_id: null,
    role: "super_admin",
  };

  c.set("admin", admin);
  c.set("authToken", resolvedAuthToken);

  await next();
});
