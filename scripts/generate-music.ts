import { writeFileSync } from "node:fs";

/** Original eight-bar ambient loop: warm pads, glassy plucks and a subdued pulse. */
export function generateMusic() {
  const rate = 22050;
  const beat = 60 / 96;
  const length = Math.round(rate * beat * 32);
  const left = new Float64Array(length);
  const right = new Float64Array(length);
  const chords = [
    [52, 59, 66, 67],
    [48, 55, 59, 64],
    [45, 52, 59, 60],
    [47, 54, 57, 62],
  ];

  function voice(
    start: number,
    duration: number,
    note: number,
    gain: number,
    pan: number,
    pad: boolean,
  ) {
    const frequency = 440 * 2 ** ((note - 69) / 12);
    for (let i = 0; i < duration * rate; i++) {
      const time = i / rate;
      const phase = 2 * Math.PI * frequency * time;
      const envelope = pad
        ? Math.min(1, time / 0.8) * Math.min(1, (duration - time) / 1.2)
        : (1 - Math.exp(-time / 0.008)) *
          Math.exp(-time * 5) *
          Math.min(1, (duration - time) / 0.1);
      const tone = pad
        ? Math.sin(phase) * 0.7 + Math.sin(phase * 1.002) * 0.25 + Math.sin(phase * 2) * 0.05
        : Math.sin(phase + Math.sin(phase * 2) * Math.exp(-time * 8) * 0.9);
      const sample = tone * envelope * gain;
      const index = (Math.round(start * rate) + i) % length;
      left[index] += sample * Math.sqrt((1 - pan) / 2);
      right[index] += sample * Math.sqrt((1 + pan) / 2);
    }
  }

  chords.forEach((chord, bar) => {
    const start = bar * beat * 8;
    chord.forEach((note, index) =>
      voice(start, beat * 8 + 1.2, note, 0.07, (index - 1.5) * 0.4, true),
    );
    for (let pulse = 0; pulse < 4; pulse++) {
      voice(start + pulse * beat * 2, 0.8, chord[0] - 12, 0.16, 0, false);
    }
    for (let step = 0; step < 8; step++) {
      if (step === 3 || step === 6) continue;
      const note = chord[[0, 2, 1, 3, 2, 1, 3, 2][step]] + 12;
      const onset = start + (step + 0.5) * beat;
      const pan = step % 2 ? 0.45 : -0.45;
      voice(onset, 1.3, note, 0.075, pan, false);
      voice(onset + beat * 0.75, 1.3, note, 0.025, -pan, false);
    }
  });

  // Circular mixing includes the previous loop's tails at the beginning: no loop-boundary fade or click.
  const data = Buffer.alloc(44 + length * 4);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(length * 4, 40);
  for (let i = 0; i < length; i++) {
    data.writeInt16LE(Math.round(Math.tanh(left[i]) * 24000), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.tanh(right[i]) * 24000), 46 + i * 4);
  }
  writeFileSync("public/assets/audio/ambient.wav", data);
}
