import { playDialogueSound, setIntroAudioStarted } from "../game/dialogueAudio";
import { useEffect, useRef, useState } from "react";
import { GameSprite } from "./GameArt";
import "./prisonIntro.css";

const dialogue = [
  {
    speaker: "drilly",
    text: "I locked every key in this computer. No one leaves my system.",
  },
  {
    speaker: "esc",
    text: "You locked up the Escape key? You really didn’t think this through.",
  },
  {
    speaker: "drilly",
    text: "A gap in the bars? You still have to get past my security to reach it.",
  },
  {
    speaker: "esc",
    text: "Hey, you out there. Help me jump. We’re getting out of here.",
  },
  {
    speaker: "drilly",
    text: "Escape this cell, and you can build your own room. Then we’ll see who traps whom.",
  },
] as const;

export function PrisonIntro({ onStart }: { onStart: () => void }) {
  const [entered, setEntered] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setIntroAudioStarted(false);
    stage.current?.focus();
  }, []);
  useEffect(() => {
    if (entered) stage.current?.focus();
  }, [entered]);
  const [line, setLine] = useState(0);
  const [wordsShown, setWordsShown] = useState(0);
  const current = dialogue[line];
  const words = current.text.split(" ");
  const complete = wordsShown >= words.length;

  useEffect(() => {
    if (!entered || complete) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const timer = window.setTimeout(() => setWordsShown(words.length), 0);
      return () => clearTimeout(timer);
    }
    const timer = window.setInterval(
      () => setWordsShown((count) => count + 1),
      155,
    );
    return () => clearInterval(timer);
  }, [entered, line, complete, words.length]);

  useEffect(() => {
    if (wordsShown > 0)
      playDialogueSound({ kind: "word", speaker: current.speaker });
  }, [wordsShown, current.speaker]);

  function advance() {
    playDialogueSound({ kind: "switch", speaker: current.speaker });
    if (line === dialogue.length - 1) onStart();
    else {
      setLine(line + 1);
      setWordsShown(0);
    }
  }

  function enter() {
    setIntroAudioStarted(true);
    setEntered(true);
  }

  if (!entered)
    return (
      <div
        ref={stage}
        className="prison-intro prison-entry"
        role="button"
        tabIndex={0}
        aria-label="Press or tap or click to start"
        onClick={enter}
        onKeyDown={(event) => {
          if (
            event.repeat ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            ["Tab", "Shift", "Control", "Alt", "Meta", "Escape"].includes(
              event.key,
            )
          )
            return;
          event.preventDefault();
          enter();
        }}
      >
        <GameSprite name="esc" />
        <span className="prison-entry-prompt">
          Press or tap or click to start
        </span>
      </div>
    );

  return (
    <div
      ref={stage}
      className={`prison-intro speaking-${current.speaker}`}
      role="button"
      tabIndex={0}
      aria-label="Prison introduction. Click or press Space to continue."
      onClick={advance}
      onKeyDown={(event) => {
        if (["Space", "Enter", "Escape"].includes(event.code)) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) advance();
        }
      }}
    >
      <button
        className="prison-skip"
        onClick={(event) => {
          event.stopPropagation();
          onStart();
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        Skip intro <span aria-hidden="true">→</span>
      </button>
      <div className="prison-portrait portrait-esc">
        <GameSprite name="esc" />
      </div>
      <div className="prison-portrait portrait-drilly">
        <GameSprite name="drilly" />
      </div>
      <div key={line} className="prison-speech">
        <svg
          className="prison-cloud-shape"
          viewBox="0 0 400 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M200 12C310 12 389 39 389 133C389 188 368 222 337 243Q341 274 375 301Q329 295 302 264C272 275 237 279 200 279C84 279 11 245 11 145C11 48 80 12 200 12Z" />
        </svg>
        <span className="prison-speaker">
          {current.speaker === "esc" ? "ESC" : "Drilly"}
        </span>
        <p aria-label={current.text}>
          {words.map((word, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={index < wordsShown ? "word-revealed" : "word-hidden"}
            >
              {word}{" "}
            </span>
          ))}
        </p>
        <span className="sr-only" role="status">
          {current.text}
        </span>
      </div>
      <span className="prison-continue">
        Click or press Space{" "}
        {line === dialogue.length - 1 ? "to escape" : "to continue"}
      </span>
    </div>
  );
}
