import {
  getDungeon,
  newPlayerDungeon,
  getPrison,
} from "../../shared/game/campaign";
import { getObstacleLab } from "../../shared/game/obstacleLab";

const wall = newPlayerDungeon();
wall.id = "eval-return";
wall.treasures = [{ id: "behind", x: 40, y: 392, width: 24, height: 28 }];

export const drillyCases = {
  saws: getDungeon("first-vault"),
  wall,
  spikes: getObstacleLab("spikes"),
  slider: getObstacleLab("slider"),
  prison: getPrison(),
};
