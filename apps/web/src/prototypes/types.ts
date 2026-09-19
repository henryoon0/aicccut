import type { ComponentType } from "react";

/** One direction for a step. Names describe the direction, never "Option A". */
export interface VariantDef {
  /** Short direction name shown in the picker, e.g. "Quiet", "Editorial". */
  name: string;
  /** Korean one-liner of the axis this variant explores. */
  axis: string;
  /** Korean: when this direction is the right call. */
  when: string;
  /** Korean: what it costs. */
  cost: string;
  /** Full-size, fully working rendering of the step in realistic context. */
  component: ComponentType;
  /** Set when the variant occupies the bottom-center (toast, dock, sheet). */
  pickerPosition?: "bottom" | "top";
  /** False when there is no entrance/state motion worth replaying. */
  hasMotion?: boolean;
}

export interface StepModule {
  variants: readonly VariantDef[];
}

export interface StepMeta {
  slug: string;
  /** Step number for display, 1-based. */
  order: number;
  title: string;
  /** What this step covers, one or two Korean sentences. */
  description: string;
  /** The single decision henry makes on this step. */
  decision: string;
  /** Which ambient theme suits judging this step. */
  theme: "dark" | "light";
}
