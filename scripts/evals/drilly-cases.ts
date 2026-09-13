import { getExampleRoom } from "../../shared/testing/rooms";
import { newPlayerDungeon, getPrison } from "../../shared/game/rooms";
import { obstacleRoom } from "../../shared/testing/obstacles";

const wall = newPlayerDungeon();
wall.id = "eval-return";
wall.treasures = [{ id: "behind", x: 40, y: 392, width: 24, height: 28 }];

export const drillyCases = {
  saws: getExampleRoom(),
  wall,
  spikes: obstacleRoom("spikes"),
  slider: obstacleRoom("slider"),
  prison: getPrison(),
};
