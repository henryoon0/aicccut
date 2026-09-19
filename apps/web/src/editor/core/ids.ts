/** Unique ids that stay unique across reloads (random part + counter). */
let seq = 0;
const rand = () => Math.random().toString(36).slice(2, 7);

/** New id with a short prefix, e.g. `newId("c")` → "c_k3f9a_12". */
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${rand()}_${seq}`;
}
