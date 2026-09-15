import { newPlayerDungeon } from "../../shared/game/rooms";
import type { Level, Replay } from "../../shared/game/types";
import { parseDrillyModel, parseEditorLevel } from "../../shared/validation";
import { RULES } from "../../shared/game/rules";
import type { DrillyModel } from "../../shared/game/drilly";
import type { Session } from "../game/session";

const DUNGEON_KEY = "drilly-p.dungeon";
const MODEL_KEY = "drilly-p.model";
const CLEAR_KEY = "drilly-p.dungeon-clear";

export function loadDungeonClear(): unknown {
  try {
    const saved = localStorage.getItem(CLEAR_KEY);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    // The session verifies the recording against the restored room and current rules.
  }
}

export function loadModel(): DrillyModel {
  try {
    return parseDrillyModel(localStorage.getItem(MODEL_KEY));
  } catch {
    return RULES.drilly.defaultModel;
  }
}

export function loadDungeon(): Level | undefined {
  try {
    const saved = localStorage.getItem(DUNGEON_KEY);
    if (saved) return parseEditorLevel(JSON.parse(saved), newPlayerDungeon());
  } catch {
    // Invalid drafts or unavailable storage must not prevent opening the game.
  }
}

export function persistDungeon(session: Session) {
  let savedLevel: Level | undefined;
  let savedClear: Replay | null | undefined;
  let savedModel = session.getSnapshot().model;

  function save() {
    const { editorLevel: level, model, playerClear } = session.getSnapshot();

    try {
      if (level !== savedLevel) {
        localStorage.setItem(DUNGEON_KEY, JSON.stringify(level));
        savedLevel = level;
      }
      if (playerClear !== savedClear) {
        localStorage.setItem(CLEAR_KEY, JSON.stringify(playerClear));
        savedClear = playerClear;
      }
      if (model !== savedModel) {
        localStorage.setItem(MODEL_KEY, model);
        savedModel = model;
      }
    } catch {
      // Keep editing in memory when storage is blocked or full.
    }
  }

  // Also preserve an existing session when this effect attaches after a hot update.
  save();
  return session.subscribe(save);
}
