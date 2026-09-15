import { useEffect, useId, useRef, useState } from "react";
import type { DrillyModel } from "../../shared/game/drilly";
import { RULES } from "../../shared/game/rules";
import { GameIcon } from "./GameArt";

export function ModelPicker({
  value,
  onChange,
}: {
  value: DrillyModel;
  onChange: (value: DrillyModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const selected = RULES.drilly.models.findIndex((model) => model.id === value);

  useEffect(() => {
    if (!open) return;
    options.current[selected]?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, selected]);

  return (
    <div
      className="model-control"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        className="model-trigger"
        ref={trigger}
        aria-label={`Drilly model: ${RULES.drilly.models[selected].label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>
          <span className="model-caption">Drilly</span>
          <span className="model-value">
            {RULES.drilly.models[selected].label}
          </span>
        </span>
        <svg className="model-chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d={open ? "m5 7 5 5 5-5" : "m5 12 5-5 5 5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          className="model-menu"
          role="menu"
          aria-label="Drilly model"
          onKeyDown={(event) => {
            const index = options.current.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            let next: number;
            if (event.key === "ArrowDown")
              next = (index + 1) % options.current.length;
            else if (event.key === "ArrowUp")
              next =
                (index + options.current.length - 1) % options.current.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.current.length - 1;
            else return;
            event.preventDefault();
            options.current[next]?.focus();
          }}
        >
          {RULES.drilly.models.map((model, index) => (
            <button
              key={model.id}
              type="button"
              className="model-option"
              role="menuitemradio"
              aria-checked={model.id === value}
              tabIndex={-1}
              ref={(element) => {
                options.current[index] = element;
              }}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {model.label}
              {model.id === value && <GameIcon name="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
