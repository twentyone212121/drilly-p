import type { BuildContext } from "../../shared/game/drilly";
import { RULES } from "../../shared/game/rules";
import { parseBuildContext } from "../../shared/validation";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;

// Store only bounded room/learning summaries, never inputs, credentials, or medals.
// Browser storage is optional: unavailable, incompatible, or corrupt data must
// not prevent a guest from playing. Scope separates deployments and guest owners.
export function drillyMemoryOptions(
  scope: string,
  storage: StorageAccess = () => window.localStorage,
) {
  const key = `drilly-p:learning:1:${scope}`;
  let history: BuildContext = { recentRooms: [], recentRaids: [] };
  try {
    const raw = storage().getItem(key);
    if (raw && raw.length <= 128_000) {
      const saved: unknown = JSON.parse(raw);
      if (
        saved &&
        typeof saved === "object" &&
        "rulesVersion" in saved &&
        saved.rulesVersion === RULES.version &&
        "history" in saved
      ) {
        history = parseBuildContext(saved.history);
      }
    }
  } catch {
    // Treat unavailable or outdated learning as a fresh profile.
  }

  return {
    drillyHistory: history,
    onDrillyHistoryChange(history: BuildContext) {
      try {
        storage().setItem(
          key,
          JSON.stringify({
            rulesVersion: RULES.version,
            history: parseBuildContext(history),
          }),
        );
      } catch {
        // Current-session learning still works if browser storage is blocked/full.
      }
    },
  };
}
