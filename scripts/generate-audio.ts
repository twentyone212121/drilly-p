// Original placeholder effects: deterministic PCM WAVs, no external assets.
import { mkdirSync, writeFileSync } from "node:fs";
import { generateMusic } from "./generate-music";
const rate = 22050;
const crackleTimes = [0.012, 0.065, 0.125];
const effects = {
  shot: [0.12, 740, 180],
  jump: [0.16, 280, 660],
  "wall-jump": [0.18, 340, 780],
  wall: [0.09, 190, 85],
  scrape: [0.64, 125, 125],
  land: [0.07, 140, 70],
  footstep: [0.055, 210, 95],
  death: [2.4, 240, 150],
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
  let noiseSeed = 17;
  let softNoise = 0;
  let crackleNoise = 0;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    phase += (2 * Math.PI * (from + (to - from) * t)) / rate;
    const envelope = Math.min(1, t * 30) * (1 - t) ** 2;
    let sample = Math.sin(phase) * envelope * 11000;
    if (name === "jump" || name === "wall-jump" || name === "wall") {
      const seconds = i / rate;
      noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
      const noise = (noiseSeed / 0xffffffff) * 2 - 1;
      softNoise += (noise - softNoise) * 0.14;
      const attack = 1 - Math.exp(-seconds / 0.003);
      if (name === "wall") {
        // A cushioned keycap knock, with a brief metallic edge.
        const knock = Math.sin(phase) * 0.8 + Math.sin(phase * 2.7) * Math.exp(-seconds * 95) * 0.2;
        sample = (knock + softNoise * 0.4) * attack * Math.exp(-seconds * 45) * (1 - t) * 7000;
      } else {
        // Airy upward blip; wall push-off has a slightly firmer initial kick.
        const lift = Math.sin(phase + Math.sin(phase * 2) * 0.22 * (1 - t));
        const air = softNoise * Math.sin(Math.PI * t) * 0.3;
        const kick =
          name === "wall-jump"
            ? Math.sin(2 * Math.PI * 135 * seconds) * Math.exp(-seconds * 70) * 0.4
            : 0;
        sample = (lift * 0.7 + air + kick) * attack * (1 - t) ** 1.7 * 6500;
      }
    }
    if (name === "shot") {
      const seconds = i / rate;
      const attack = 1 - Math.exp(-seconds / 0.003);
      const tone = Math.sin(phase + Math.sin(phase * 2) * 0.45 * (1 - t));
      sample = tone * attack * Math.exp(-seconds * 24) * (1 - t) * 6000;
    }
    if (name === "scrape") {
      const seconds = i / rate;
      noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
      const noise = (noiseSeed / 0xffffffff) * 2 - 1;
      // Soft, intermittent dry friction instead of a continuous buzzy hiss.
      softNoise += (noise - softNoise) * 0.012;
      crackleNoise += (noise - crackleNoise) * 0.12;
      const grain = Math.max(0, Math.sin(2 * Math.PI * t * 5 + Math.sin(2 * Math.PI * t * 3))) ** 3;
      const edge = Math.min(1, seconds / 0.025, (duration - seconds) / 0.035);
      sample = (crackleNoise - softNoise) * (0.08 + grain * 0.92) * edge * 3500;
    }
    if (name === "footstep") {
      const seconds = i / rate;
      noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
      const noise = (noiseSeed / 0xffffffff) * 2 - 1;
      softNoise += (noise - softNoise) * 0.2;
      const tapEnvelope = (1 - Math.exp(-seconds / 0.002)) * Math.exp(-seconds * 85) * (1 - t);
      sample = (Math.sin(phase) * 0.75 + softNoise * 0.5) * tapEnvelope * 4500;
    }
    if (name === "death") {
      const seconds = i / rate;
      noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
      const noise = (noiseSeed / 0xffffffff) * 2 - 1;
      // A brief capacitor-discharge snap; the remaining tail is a clean hum.
      softNoise += (noise - softNoise) * 0.06;
      crackleNoise += (noise - crackleNoise) * 0.4;
      const burst = crackleTimes.reduce((sum, time, index) => {
        const age = seconds - time;
        if (age < 0) return sum;
        return sum + (1 - Math.exp(-age / 0.002)) * Math.exp(-age / 0.018) * (1 - index * 0.18);
      }, 0);
      const snapPhase = 2 * Math.PI * (1300 * seconds - 1500 * seconds * seconds);
      const discharge = Math.sin(snapPhase + Math.sin(snapPhase * 1.41) * 1.6);
      const snapFade = Math.max(0, Math.min(1, (0.24 - seconds) / 0.04));
      const crackle =
        Math.tanh((crackleNoise - softNoise) * 2 + discharge * 0.55) * burst * snapFade * 8500;
      const tone = Math.sin(phase) + Math.sin(phase * 2) * 0.08;
      const pulse = 0.9 + Math.sin(seconds * Math.PI * 6) * 0.1;
      const attack = 1 - Math.exp(-seconds / 0.07);
      const release = Math.min(1, (duration - seconds) / 0.65);
      const shockEnvelope = attack * Math.exp(-seconds * 1.15) * release * release;
      sample = tone * pulse * shockEnvelope * 4200 + crackle;
    }
    data.writeInt16LE(Math.round(sample), 44 + i * 2);
  }
  writeFileSync(`public/assets/audio/${name}.wav`, data);
}

generateMusic();
