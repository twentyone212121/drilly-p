import { getExampleRoom } from "./rooms";
import type { Level } from "../game/types";
import type { ModelCall } from "../../convex/lib/drilly/model";

// Fixture outputs only; ordinary tests use the real simulation without model calls.
export const fakeModel: ModelCall = async (_instructions, data, output) => {
  if (output.schemaName === "drilly_inputs") {
    const { room } = data as { room: Level };
    return { jumpTicks: room.traps.length ? [34, 106] : [] };
  }
  const { name, platforms, traps, treasures, obstacles = [] } = getExampleRoom();
  return { level: { name, platforms, traps, treasures, obstacles } };
};
