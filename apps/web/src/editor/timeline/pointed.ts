import type { MutableRefObject } from "react";

/**
 * Marks that a real pointer press started on an element, so its `click`
 * handler can tell a genuine press (already handled by pointer logic) from a
 * bare click sent by assistive tech or automation. The mark clears one tick
 * after the next pointerup, which is after the click that press produces, and
 * also when a drag ends off the element and no click follows.
 */
export function markPointed(ref: MutableRefObject<boolean>): void {
  ref.current = true;
  const clear = () => {
    window.removeEventListener("pointerup", clear);
    window.removeEventListener("pointercancel", clear);
    setTimeout(() => {
      ref.current = false;
    }, 0);
  };
  window.addEventListener("pointerup", clear);
  window.addEventListener("pointercancel", clear);
}
