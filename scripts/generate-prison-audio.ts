// Original, non-musical ventilation/electrical ambience. A seamless eight-second bed.
import { writeFileSync } from "node:fs";
const rate = 22050;
const seconds = 8;
const samples = rate * seconds;
const wav = Buffer.alloc(44 + samples * 2);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(samples * 2, 40);
let seed = 73;
let air = 0;
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = (seed / 0xffffffff) * 2 - 1;
  air += (noise - air) * 0.025;
  const fade = Math.min(1, t * 8, (seconds - t) * 8);
  const hum =
    Math.sin(2 * Math.PI * 50 * t) * 0.065 +
    Math.sin(2 * Math.PI * 100 * t) * 0.012;
  const crackle = [1.2, 1.29, 4.7, 6.1].reduce(
    (sum, start) => sum + (t > start ? Math.exp(-(t - start) * 85) : 0),
    0,
  );
  wav.writeInt16LE(
    Math.round((hum + air * 0.35 + noise * crackle * 0.055) * fade * 16000),
    44 + i * 2,
  );
}
writeFileSync("public/assets/audio/prison.wav", wav);
