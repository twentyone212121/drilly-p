// Original placeholder effects: deterministic PCM WAVs, no external assets.
import { mkdirSync, writeFileSync } from "node:fs";
const rate = 22050;
const effects = {
  jump: [0.12, 420, 920],
  land: [0.07, 140, 70],
  death: [0.28, 360, 65],
  win: [0.42, 520, 1040],
};
mkdirSync("public/assets/audio", { recursive: true });
for (const [name, [duration, from, to]] of Object.entries(effects)) {
  const count = Math.floor(rate * duration);
  const data = Buffer.alloc(44 + count * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(count * 2, 40);
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    phase += (2 * Math.PI * (from + (to - from) * t)) / rate;
    const envelope = Math.min(1, t * 30) * (1 - t) ** 2;
    data.writeInt16LE(Math.round(Math.sin(phase) * envelope * 11000), 44 + i * 2);
  }
  writeFileSync(`public/assets/audio/${name}.wav`, data);
}
