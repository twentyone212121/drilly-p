import { interpolateFrame } from "./interpolateFrame";
import { OBSTACLE_TEXTURES } from "./obstacleArt";
import Phaser from "phaser";
import { initialState } from "../../../shared/game/simulation";
import type { Level, State } from "../../../shared/game/types";
import type { Session } from "../session";
import { AUDIO } from "./assets";
import { createAudio, type AudioSettings } from "./audio";
import { createRoomArt } from "./roomArt";
import { createEditorInput, type EditorOptions } from "./editorInput";

export class GameScene extends Phaser.Scene {
  private roomArt?: ReturnType<typeof createRoomArt>;
  private audio?: ReturnType<typeof createAudio>;
  private lastTick = 0;
  private wasPaused = true;
  private level?: Level;
  private editor?: ReturnType<typeof createEditorInput>;
  private draftState?: State;
  private wakeFrame = 0;
  private ready = false;

  constructor(
    private session: Session,
    private settings: AudioSettings,
    private editorOptions: EditorOptions,
  ) {
    super("room");
  }

  preload() {
    for (const name of OBSTACLE_TEXTURES) {
      if (name === "turret") this.load.image("obstacle-turret", "/assets/obstacles/turret.png");
      else this.load.svg(`obstacle-${name}`, `/assets/obstacles/${name}.svg`);
    }
    for (const name of ["esc", "esc-run", "esc-wall", "drilly"]) {
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
    this.editor = createEditorInput(
      this.game.canvas,
      this.session,
      this.editorOptions,
      (selected, preview, invalid) => this.roomArt?.editor(selected, preview, invalid),
      () => this.requestRender(),
    );
    this.ready = true;
    this.editor.setOptions(this.editorOptions);
  }

  update(_time: number, delta: number) {
    this.syncLevel(this.session.getSnapshot().level);
    this.session.update(delta);
    const view = this.session.getSnapshot();
    this.syncLevel(view.level);
    this.editor?.flushPreview();
    const editing = view.phase === "build";
    this.audio?.updateMovement(
      this.session.frameState(),
      !editing && view.canPlay && !view.paused && view.mode === "human",
    );
    const animating = this.roomArt?.update(
      editing ? this.draftState! : interpolateFrame(this.session.renderFrame()),
      !editing && view.mode === "replay",
      delta,
      editing,
    );
    this.roomArt?.comparison(this.session.ghostFrame());
    if ((view.paused || !view.canPlay) && !view.presentingDeath && !animating)
      this.game.loop.sleep();
  }

  // Coalesce input/resize wakes; Phaser remains the only continuous frame loop.
  requestRender() {
    if (!this.ready || this.game.loop.running || this.wakeFrame) return;
    this.wakeFrame = requestAnimationFrame(() => {
      this.wakeFrame = 0;
      if (this.ready) {
        this.game.loop.resetDelta();
        this.game.loop.wake();
      }
    });
  }

  setEditor(options: EditorOptions) {
    this.editorOptions = options;
    this.editor?.setOptions(options);
  }

  setAudio(settings: AudioSettings) {
    this.settings = settings;
    this.audio?.apply(settings);
  }

  private syncLevel(level: Level) {
    if (this.level === level) return;
    this.level = level;
    this.draftState = initialState(level);
    if (this.scale.width !== level.width || this.scale.height !== level.height)
      this.scale.setGameSize(level.width, level.height);
    this.roomArt?.destroy();
    this.roomArt = createRoomArt(this, level);
    this.editor?.setLevel(level);
    this.editor?.setOptions(this.editorOptions);
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
    const offSession = this.session.subscribe(() => {
      this.stopAudioOnTransition();
      this.requestRender();
    });
    let disposed = false;

    const cleanup = () => {
      if (disposed) return;

      disposed = true;
      this.ready = false;
      cancelAnimationFrame(this.wakeFrame);
      this.editor?.destroy();
      this.roomArt?.destroy();
      offEvents();
      offSession();
      this.audio?.destroy();
    };

    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
  }
}
