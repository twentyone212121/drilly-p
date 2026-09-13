import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { newPlayerDungeon } from "../../shared/game/campaign";
import { directStrategy } from "./testing";
import { localDrillyHandler } from "./local";

function request(payload: string, headers: Record<string, string> = {}) {
  return Object.assign(Readable.from([payload]), {
    url: "/api/drilly/raid",
    method: "POST",
    headers: {
      host: "127.0.0.1:5173",
      "content-type": "application/json",
      ...headers,
    },
    socket: { remoteAddress: "127.0.0.1" },
  }) as unknown as IncomingMessage;
}
function response() {
  const writeHead = vi.fn(),
    end = vi.fn();
  return {
    res: { writeHead, end } as unknown as ServerResponse,
    writeHead,
    end,
  };
}
const body = () => JSON.stringify({ level: newPlayerDungeon() });

describe("local Drilly API", () => {
  it("executes a real simulated raid without Convex", async () => {
    const plan = vi.fn(async () => directStrategy(newPlayerDungeon()));
    const output = response();
    await localDrillyHandler(() => plan)(request(body()), output.res, vi.fn());
    expect(output.writeHead.mock.calls[0][0]).toBe(200);
    expect(JSON.parse(output.end.mock.calls[0][0])[0].outcome).toBe("won");
    expect(plan).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign origins, rebinding hosts, and oversized/invalid requests before calling AI", async () => {
    const plan = vi.fn();
    const handle = localDrillyHandler(() => plan);
    for (const [payload, headers, status] of [
      [body(), { origin: "https://foreign.test" }, 403],
      [body(), { host: "foreign.test" }, 403],
      ["x".repeat(64_001), {}, 413],
      ["null", {}, 400],
      ["[]", {}, 400],
    ] as [string, Record<string, string>, number][]) {
      const output = response();
      await handle(request(payload, headers), output.res, vi.fn());
      expect(output.writeHead.mock.calls[0][0]).toBe(status);
    }
    expect(plan).not.toHaveBeenCalled();
  });
  it("bounds concurrent paid requests and releases the slot after an error", async () => {
    let reject!: (error: Error) => void;
    const plan = vi.fn(
      () =>
        new Promise((_, r) => {
          reject = r;
        }),
    );
    const handle = localDrillyHandler(() => plan);
    const first = response();
    const pending = handle(request(body()), first.res, vi.fn());
    await vi.waitFor(() => expect(plan).toHaveBeenCalledTimes(1));
    const second = response();
    await handle(request(body()), second.res, vi.fn());
    expect(second.writeHead.mock.calls[0][0]).toBe(429);
    reject(new Error("no key"));
    await pending;
    expect(first.writeHead.mock.calls[0][0]).toBe(503);
  });
});
