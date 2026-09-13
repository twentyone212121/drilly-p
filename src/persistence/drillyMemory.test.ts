import { describe, expect, it } from "vitest";
import { getDungeon } from "../../shared/game/campaign";
import { RULES } from "../../shared/game/rules";
import { parseBuildContext } from "../../shared/validation";
import { drillyMemoryOptions } from "./drillyMemory";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("Drilly learning persistence", () => {
  it("restores rooms and completed raid summaries across reloads, scoped by profile", () => {
    const storage = memoryStorage();
    const history = {
      recentRooms: [getDungeon("first-vault")],
      recentRaids: [
        {
          level: getDungeon("first-vault"),
          attempts: 2,
          cleared: true,
          deaths: [],
          ignoredJumps: 1,
          wallJumps: 0,
        },
      ],
    };
    drillyMemoryOptions("dev:guest-a", () => storage).onDrillyHistoryChange(
      history,
    );
    expect(
      drillyMemoryOptions("dev:guest-a", () => storage).drillyHistory,
    ).toEqual(history);
    for (const scope of ["dev:guest-b", "other-dev:guest-a", "local"])
      expect(
        drillyMemoryOptions(scope, () => storage).drillyHistory.recentRooms,
      ).toEqual([]);
  });

  it("ignores corrupt, incompatible, oversized, or excessive saved history", () => {
    for (const raw of [
      "not JSON",
      "x".repeat(128_001),
      JSON.stringify({
        rulesVersion: "old",
        history: { recentRooms: [getDungeon("first-vault")], recentRaids: [] },
      }),
      JSON.stringify({
        rulesVersion: RULES.version,
        history: {
          recentRaids: [],
          recentRooms: Array.from(
            { length: RULES.drilly.recentRoomLimit + 1 },
            () => getDungeon("first-vault"),
          ),
        },
      }),
    ]) {
      const storage = { getItem: () => raw, setItem: () => {} };
      expect(drillyMemoryOptions("a", () => storage).drillyHistory).toEqual({
        recentRaids: [],
        recentRooms: [],
      });
    }
    expect(() =>
      parseBuildContext({ recentRaids: [], recentRooms: [{}] }),
    ).toThrow();
  });

  it("keeps playing when storage access or writes are blocked", () => {
    const memory = drillyMemoryOptions("a", () => {
      throw new Error("blocked");
    });
    expect(memory.drillyHistory.recentRooms).toEqual([]);
    expect(() =>
      memory.onDrillyHistoryChange({ recentRaids: [], recentRooms: [] }),
    ).not.toThrow();
  });
});
