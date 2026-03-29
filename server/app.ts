import { Hono } from "hono";
import { cors } from "hono/cors";
import { authApp } from "./routes/auth";
import { brandsApp } from "./routes/brands";
import { surveysApp } from "./routes/surveys";
import { questionsApp } from "./routes/questions";
import { signedUrlApp } from "./routes/signed-url";
import { sessionsApp } from "./routes/sessions";
import { responsesApp } from "./routes/responses";
import { env } from "./lib/config";

const app = new Hono().basePath("/api");

const allowedOrigins = new Set<string>([env.APP_URL, "http://localhost:5173"]);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return env.APP_URL;
      }
      return allowedOrigins.has(origin) ? origin : env.APP_URL;
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authApp);
app.route("/brands", brandsApp);
app.route("/surveys", surveysApp);
app.route("/questions", questionsApp);
app.route("/signed-url", signedUrlApp);
app.route("/sessions", sessionsApp);
app.route("/responses", responsesApp);

export default app;
