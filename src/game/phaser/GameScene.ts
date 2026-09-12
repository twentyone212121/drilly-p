import Phaser from "phaser";
import type { Level } from "../../../shared/game/types";
import type { Session } from "../session";
import { AUDIO } from "./assets";
import { createAudio, type AudioSettings, type AudioStatus } from "./audio";
import { drawRoom } from "./drawRoom";

export class GameScene extends Phaser.Scene {
  private drawing!: Phaser.GameObjects.Graphics;
  private audio?: ReturnType<typeof createAudio>;
  private label?: Phaser.GameObjects.Text;
  private lastTick = 0;
  private wasPaused = true;
  private levelRevision = -1;
  private level: Level;

  constructor(
    private session: Session,
    private settings: AudioSettings,
    private reportAudio: (status: AudioStatus) => void,
  ) {
    super("room");
    this.level = session.level;
  }

  preload() {
    for (const [key, path] of Object.entries(AUDIO)) {
      this.load.audio(key, path);
    }
  }

  create() {
    this.drawing = this.add.graphics();
    this.audio = createAudio(this, this.settings, this.reportAudio);
    this.connectAudio();
    this.input.on("pointerdown", () => this.session.jump());
  }

  update(_time: number, delta: number) {
    this.session.update(delta);
    this.syncLevel();
    drawRoom(this.drawing, this.level, this.session.frameState());
  }

  setAudio(settings: AudioSettings) {
    this.settings = settings;
    this.audio?.apply(settings);
  }

  private syncLevel() {
    if (this.levelRevision === this.session.levelRevision) return;

    this.level = this.session.level;
    this.levelRevision = this.session.levelRevision;
    this.scale.resize(this.level.width, this.level.height);

    this.label?.destroy();
    this.label = this.add.text(56, 52, "01 / " + this.level.name.toUpperCase(), {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#7d929e",
    });
  }

  private stopAudioOnTransition() {
    const view = this.session.getSnapshot();
    const restarted = view.state.tick < this.lastTick;
    const justPaused = !this.wasPaused && view.paused && view.state.status === "running";

    if (restarted || justPaused) this.audio?.stop();

    this.lastTick = view.state.tick;
    this.wasPaused = view.paused;
  }

  private connectAudio() {
    const offEvents = this.session.onEvents((events) => this.audio?.consume(events));
    const offSession = this.session.subscribe(() => this.stopAudioOnTransition());
    let disposed = false;

    const cleanup = () => {
      if (disposed) return;

      disposed = true;
      offEvents();
      offSession();
      this.audio?.destroy();
    };

    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
  }
}
