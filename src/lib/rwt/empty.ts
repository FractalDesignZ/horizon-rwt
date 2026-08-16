import type { PadField, Typewell } from "./types";

export function emptyTypewell(): Typewell {
  return { tvt: [], gr: [] };
}

export function emptyPad(): PadField {
  return {
    id: "empty",
    name: "No wells loaded",
    wells: [],
    typewell: emptyTypewell(),
  };
}
