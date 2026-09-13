import { OBSTACLE_TEXTURES } from "./obstacleArt";
import Phaser from "phaser";
import type { Level } from "../../../shared/game/types";
import type { Session } from "../session";
import { AUDIO } from "./assets";
import { createAudio, type AudioSettings } from "./audio";
import { createRoomArt } from "./roomArt";

export class GameScene extends Phaser.Scene {
  private roomArt?: ReturnType<typeof createRoomArt>;
  private audio?: ReturnType<typeof createAudio>;
  private lastTick = 0;
  private wasPaused = true;
  private levelRevision = -1;
  private level: Level;

  constructor(
    private session: Session,
    private settings: AudioSettings,
  ) {
    super("room");
    this.level = session.level;
  }

  preload() {
    for (const name of OBSTACLE_TEXTURES) {
      if (name === "turret") this.load.image("obstacle-turret", "/assets/obstacles/turret.png");
      else this.load.svg(`obstacle-${name}`, `/assets/obstacles/${name}.svg`);
    }
    for (const name of ["esc", "esc-run", "drilly"]) {
      this.load.atlas(name, `/assets/characters/${name}.png`, `/assets/characters/${name}.json`);
    }
    this.load.atlas(
      "computer-props",
      "/assets/environment/computer-props.png",
      "/assets/environment/computer-props.json",
    );
    for (const [key, path] of Object.entries(AUDIO)) {
      this.load.audio(key, path);
    }
  }

  create() {
    this.audio = createAudio(this, this.settings);
    this.connectAudio();
    this.input.on("pointerdown", () => this.session.primaryAction());
  }

  update(_time: number, delta: number) {
    this.session.update(delta);
    this.syncLevel();
    this.roomArt?.update(
      this.session.frameState(),
      this.session.getSnapshot().mode === "replay",
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
    this.roomArt?.destroy();
    this.roomArt = createRoomArt(this, this.level);
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
