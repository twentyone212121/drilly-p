import { defineApp } from "convex/server";
import { v } from "convex/values";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    DRILLY_MODEL: v.optional(v.string()),
  },
});

app.use(staticHosting);

export default app;
