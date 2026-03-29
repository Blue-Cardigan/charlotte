import { serve } from "@hono/node-server";
import app from "./app";

const port = Number(process.env.API_PORT ?? "3301");

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(`API running on http://localhost:${port}`);
  },
);
