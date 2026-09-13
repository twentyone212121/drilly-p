import firstVault from "../levels/first-vault.json";
import { parseLevel } from "../validation";

export function getExampleRoom() {
  return parseLevel(firstVault);
}
