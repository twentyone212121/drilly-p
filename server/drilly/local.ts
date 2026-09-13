import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { RULES } from "../../shared/game/rules";
import { buildDungeon, playDungeon, type Planner } from "./planner";
import { openAIPlanner } from "./provider";
import {
  DRILLY_ERRORS,
  drillyErrorMessage,
} from "../../shared/game/drillyErrors";

type Next = () => void;
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function localDrillyHandler(plan: () => Planner) {
  let busy = false;
  return async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const path = req.url?.split("?")[0];
    if (path !== "/api/drilly/build" && path !== "/api/drilly/raid")
      return next();
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    // This is a development-only local endpoint, not an unauthenticated public AI proxy.
    const host = req.headers.host ?? "";
    if (
      !loopback.has(req.socket.remoteAddress ?? "") ||
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      reply(403, { error: "Local requests only." });
      return;
    }
    if (
      req.method !== "POST" ||
      !req.headers["content-type"]?.startsWith("application/json")
    ) {
      reply(405, { error: "Use a JSON POST." });
      return;
    }
    if (busy) {
      reply(429, { error: "Drilly is already thinking." });
      return;
    }
    busy = true;
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 64_000) {
          reply(413, { error: "Room request too large." });
          return;
        }
        chunks.push(buffer);
      }
      let input: { rulesVersion?: unknown; level?: unknown; context?: unknown };
      try {
        input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (
          !input ||
          typeof input !== "object" ||
          input.rulesVersion !== RULES.version
        )
          throw new Error();
      } catch {
        reply(400, {
          error: "Invalid request or outdated rules. Reload the game.",
        });
        return;
      }
      const planner = plan();
      const result =
        path === "/api/drilly/build"
          ? await buildDungeon(planner, input.context ?? { recentRaids: [] })
          : await playDungeon(input.level, planner);
      reply(200, result);
    } catch (error) {
      reply(503, {
        error: drillyErrorMessage(error, DRILLY_ERRORS.unavailable),
      });
    } finally {
      busy = false;
    }
  };
}

export function localDrillyPlugin(apiKey?: string, model?: string): Plugin {
  return {
    name: "drilly-local-ai",
    apply: "serve",
    configureServer(server) {
      const handler = localDrillyHandler(() => openAIPlanner(apiKey, model));
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next).catch(next);
      });
    },
  };
}
