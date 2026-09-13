import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Session } from "./game/session";
import { newPlayerDungeon } from "../shared/game/campaign";

const mocks = vi.hoisted(() => ({
  client: {
    query: vi.fn(() => {
      throw new Error("Incompatible saved draft");
    }),
    watchQuery: vi.fn(() => {
      throw new Error("Incompatible saved draft");
    }),
    action: vi.fn(),
  },
  app: vi.fn((_props: { session: Session }) => null),
}));

vi.mock("convex/react", () => ({
  useConvex: () => mocks.client,
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn() }),
}));
vi.mock("./App", () => ({ default: mocks.app }));

import { GuestGame } from "./Game";

it("opens a fresh live-AI game without reading an incompatible saved draft", () => {
  renderToStaticMarkup(createElement(GuestGame));
  expect(mocks.client.query).not.toHaveBeenCalled();
  expect(mocks.client.watchQuery).not.toHaveBeenCalled();
  const { session } = mocks.app.mock.calls[0][0];
  expect(session.getSnapshot()).toMatchObject({
    liveDrilly: true,
    editorLevel: newPlayerDungeon(),
  });
});
