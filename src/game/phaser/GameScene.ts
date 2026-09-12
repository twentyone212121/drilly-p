import { OBSTACLE_TEXTURES } from "./obstacleArt";
import Phaser from "phaser";
import type { Level } from "../../../shared/game/types";
import type { Session } from "../session";
import { AUDIO } from "./assets";
import { createAudio, type AudioSettings, type AudioStatus } from "./audio";
import { createRoomArt } from "./roomArt";
import { drawAmbience } from "./ambience";

export class GameScene extends Phaser.Scene {
  private roomArt?: ReturnType<typeof createRoomArt>;
  private background!: Phaser.GameObjects.Image;
  private ambience!: Phaser.GameObjects.Graphics;
  private ambientSeconds = 0;
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
    for (const name of OBSTACLE_TEXTURES)
      this.load.svg(`obstacle-${name}`, `/assets/obstacles/${name}.svg`);
    for (const name of ["esc", "esc-run", "drilly"]) {
      this.load.atlas(name, `/assets/characters/${name}.png`, `/assets/characters/${name}.json`);
    }
    this.load.atlas(
      "computer-props",
      "/assets/environment/computer-props.png",
      "/assets/environment/computer-props.json",
    );
    this.load.image("computer-interior", "/assets/backgrounds/computer-interior.webp");
    for (const [key, path] of Object.entries(AUDIO)) {
      this.load.audio(key, path);
    }
  }

  create() {
    this.background = this.add.image(0, 0, "computer-interior").setOrigin(0);
    this.ambience = this.add.graphics();
    this.audio = createAudio(this, this.settings, this.reportAudio);
    this.connectAudio();
    this.input.on("pointerdown", () => this.session.primaryAction());
  }

  update(_time: number, delta: number) {
    this.session.update(delta);
    this.syncLevel();
    if (!this.session.getSnapshot().paused) this.ambientSeconds += Math.min(delta, 100) / 1000;
    drawAmbience(this.ambience, this.level.width, this.level.height, this.ambientSeconds);
    this.roomArt?.update(
      this.session.frameState(),
      this.session.getSnapshot().phase === "ghost",
      delta,
    );
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
    this.background.setDisplaySize(this.level.width, this.level.height);
    this.ambientSeconds = 0;
    this.roomArt?.destroy();
    this.roomArt = createRoomArt(this, this.level);

    this.label?.destroy();
    this.label = this.add.text(56, 52, this.level.name.toUpperCase(), {
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
    const offEvents = this.session.onEvents((events) => {
      this.audio?.consume(events);
      this.roomArt?.consume(events);
    });
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
