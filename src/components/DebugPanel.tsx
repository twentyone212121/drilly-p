import { useState, useSyncExternalStore } from "react";
import { describeRules, RULES } from "../../shared/game/rules";
import { replayAttempt } from "../../shared/game/replay";
import type { Session } from "../game/session";
import type { AudioStatus } from "../game/phaser/audio";

export function DebugPanel({ session, audio }: { session: Session; audio: AudioStatus }) {
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [ticks, setTicks] = useState("1");
  const [schedule, setSchedule] = useState("[44, 193]");
  const [json, setJson] = useState("");
  const [message, setMessage] = useState("");
  const [verification, setVerification] = useState("");

  function attempt(fn: () => void) {
    try {
      fn();
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function verify() {
    const result = replayAttempt(session.exportReplay());
    const matches = JSON.stringify(result.trajectory) === JSON.stringify(session.trajectory());
    setVerification(
      JSON.stringify(
        {
          matches,
          ticksCompared: result.trajectory.length,
          outcome: result.state.status,
          terminalTick: result.state.tick,
          events: result.events,
        },
        null,
        2,
      ),
    );
  }

  function advanceTicks() {
    attempt(() => session.step(Number(ticks)));
  }

  function loadSchedule() {
    attempt(() => session.loadSchedule(JSON.parse(schedule)));
  }

  function exportRecording() {
    setJson(JSON.stringify(session.exportReplay(), null, 2));
    setMessage("Recording exported below.");
  }

  function loadRecording() {
    attempt(() => {
      if (json.length > 200000) throw new Error("Replay JSON is too large.");

      session.loadReplay(JSON.parse(json));
    });
  }

  const observation = {
    level: session.level,
    state: view.state,
    rulesVersion: RULES.version,
    paused: view.paused,
    mode: view.mode,
    pendingJump: view.pendingJump,
    jumpTicks: view.jumps,
  };

  return (
    <details className="debug-panel">
      <summary>
        <span>Developer tools</span>
        <small>STATE · INPUT · REPLAY</small>
      </summary>
      <div className="debug-content">
        <p className="hint">
          Paused Jump queues an input; Step consumes it. Tick N is applied before advancing to N+1.
          All tools use the same simulation.
          {view.phase === "testing" &&
            " Replay and schedule playback do not unlock submission. Restart restores your test dungeon."}
        </p>
        <div className="debug-grid">
          <section>
            <h3>Drive an attempt</h3>
            <div className="field-row">
              <label>
                Advance ticks
                <input
                  aria-label="Advance ticks"
                  type="number"
                  min="1"
                  max="1800"
                  value={ticks}
                  onChange={(e) => setTicks(e.target.value)}
                />
              </label>
              <button onClick={advanceTicks}>Step</button>
            </div>
            <label>
              Jump schedule
              <textarea
                aria-label="Jump schedule"
                rows={2}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                spellCheck={false}
              />
            </label>
            <div className="field-row">
              <button onClick={loadSchedule}>Load schedule</button>
              <span className="hint">Loads paused. Press Play to watch.</span>
            </div>
            <h3>Record & replay</h3>
            <div className="field-row">
              <button onClick={exportRecording}>Export recording</button>
              <button onClick={loadRecording}>Load replay JSON</button>
              <button onClick={() => attempt(verify)}>Check replay parity</button>
            </div>
            <label>
              Replay JSON
              <textarea
                aria-label="Replay JSON"
                rows={7}
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder="Export a recording, or paste a replay here."
                spellCheck={false}
              />
            </label>
            {message && <p role="alert">{message}</p>}
            {verification && <pre data-testid="replay-verification">{verification}</pre>}
          </section>
          <section>
            <h3>Live observation</h3>
            <pre data-testid="game-observation">{JSON.stringify(observation, null, 2)}</pre>
            <h3>Events</h3>
            <pre data-testid="game-events">
              {view.events.length
                ? view.events.map((event) => JSON.stringify(event)).join("\n")
                : "No events yet."}
            </pre>
            <h3>Audio diagnostics</h3>
            <pre data-testid="audio-status">{JSON.stringify(audio, null, 2)}</pre>
          </section>
        </div>
        <details>
          <summary>Game rules</summary>
          <pre>{JSON.stringify(describeRules(), null, 2)}</pre>
        </details>
      </div>
    </details>
  );
}
