// Original low, slow minor synth bed and short interface voices; deterministic PCM.
import { writeFileSync } from "node:fs";
const rate = 22050;
function write(name: string, duration: number, sample: (t: number) => number) {
  const count = Math.round(rate * duration);
  const wav = Buffer.alloc(44 + count * 2);
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
  wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    wav.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, sample(i / rate))) * 32767),
      44 + i * 2,
    );
  writeFileSync(`public/assets/audio/${name}.wav`, wav);
}
const sine = (frequency: number, t: number) =>
  Math.sin(Math.PI * 2 * frequency * t);
// A slow 80 BPM pulse with moving minor chords, warm bass and a glassy motif.
write("intro", 24, (t) => {
  const fade = Math.min(1, t / 0.35, (24 - t) / 0.45);
  const chords = [
    [110, 130.8128, 164.8138],
    [87.3071, 110, 130.8128],
    [73.4162, 87.3071, 110],
    [82.4069, 98, 123.4708],
  ];
  let pad = 0;
  for (let index = 0; index < chords.length; index++) {
    const age = (t - index * 6 + 24) % 24;
    if (age >= 7.5) continue;
    const envelope = Math.min(1, age / 1.2, (7.5 - age) / 1.5);
    pad +=
      chords[index].reduce(
        (sum, note) => sum + sine(note, t) * 0.048 + sine(note * 2, t) * 0.012,
        0,
      ) * envelope;
  }
  const chord = chords[Math.floor(t / 6)];
  const beat = t % 0.75;
  const step = Math.floor(t / 0.75);
  const bass =
    sine(chord[0] / 2, t) *
    (1 - Math.exp(-beat * 60)) *
    Math.exp(-beat * 4) *
    0.13;
  const motif = [2, 1, 2, 0, 2, 1, 0, 1];
  const note = chord[motif[step % 8]] * 2;
  const pluck =
    (sine(note, beat) + sine(note * 2, beat) * 0.12) *
    (1 - Math.exp(-beat * 90)) *
    Math.exp(-beat * 7) *
    0.075;
  const kickAge = t % 1.5;
  const kick =
    Math.sin(
      2 * Math.PI * (48 * kickAge + 1.5 * (1 - Math.exp(-kickAge * 24))),
    ) *
    Math.exp(-kickAge * 18) *
    Math.min(1, kickAge * 250) *
    0.065;
  return Math.tanh((pad + bass + pluck + kick) * 1.15) * fade;
});
let seed = 91;
let softNoise = 0;
function air() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  softNoise += ((seed / 0xffffffff) * 2 - 1 - softNoise) * 0.08;
  return softNoise;
}
// A soft, dry key tap: mostly filtered air with a brief cushioned knock.
write("dialogue-word", 0.045, (t) => {
  const envelope =
    (1 - Math.exp(-t * 650)) * Math.exp(-t * 100) * Math.max(0, 1 - t / 0.045);
  const knock = sine(180, t) * Math.exp(-t * 130);
  return (air() * 0.42 + knock * 0.06) * envelope;
});
// A light brushed transition with a soft low knock, no bright rising chirp.
write("dialogue-switch", 0.18, (t) => {
  const envelope = Math.sin((Math.PI * t) / 0.18) ** 2;
  return (air() * 0.18 + sine(170, t) * Math.exp(-t * 22) * 0.055) * envelope;
});
