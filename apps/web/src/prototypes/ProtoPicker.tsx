import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./proto-picker.css";

interface ProtoPickerProps {
  names: readonly string[];
  active: number;
  onSelect: (index: number) => void;
  onReplay: () => void;
  /** Render the replay control only when a variant has motion to re-trigger. */
  hasMotion?: boolean;
  /** Move the pill to the top when a variant occupies the bottom-center. */
  position?: "bottom" | "top";
}

/**
 * The picker is harness chrome, not a contestant. Markup, styles and the
 * behaviour contract come verbatim from the prototype skill's PICKER.md.
 */
export function ProtoPicker({
  names,
  active,
  onSelect,
  onReplay,
  hasMotion = true,
  position = "bottom",
}: ProtoPickerProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = itemRefs.current[active];
    const hl = highlightRef.current;
    if (!el || !hl) return;
    hl.style.width = `${el.offsetWidth}px`;
    hl.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [active, names]);

  useEffect(() => {
    const onResize = () => {
      const el = itemRefs.current[active];
      const hl = highlightRef.current;
      if (!el || !hl) return;
      hl.style.width = `${el.offsetWidth}px`;
      hl.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= names.length) onSelect(num - 1);
      else if (e.key === "ArrowRight") onSelect((active + 1) % names.length);
      else if (e.key === "ArrowLeft") onSelect((active - 1 + names.length) % names.length);
      else if (e.key === "r" || e.key === "R") onReplay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, names.length, onSelect, onReplay]);

  return (
    <nav
      className="proto-picker"
      aria-label="Prototype variants"
      data-ready={ready ? "" : undefined}
      data-position={position === "top" ? "top" : undefined}
    >
      <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
      {names.map((name, i) => (
        <button
          key={name}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          type="button"
          className="proto-picker-item"
          data-active={i === active ? "" : undefined}
          aria-current={i === active ? "true" : undefined}
          onClick={() => onSelect(i)}
        >
          {name}
        </button>
      ))}
      {hasMotion && (
        <>
          <span className="proto-picker-divider" aria-hidden="true" />
          <button
            type="button"
            className="proto-picker-item proto-picker-replay"
            aria-label="Replay animation (R)"
            onClick={onReplay}
          >
            ↻
          </button>
        </>
      )}
    </nav>
  );
}
