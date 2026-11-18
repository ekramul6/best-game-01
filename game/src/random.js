// A small seeded generator (mulberry32) so a shot scene or a ?seed=N game
// plays the same way every time. One instance is created per world; nothing
// in the game reads Math.random during a run.

/** Create a generator seeded by any 32-bit integer. */
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return {
    /** Next float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** Next integer in [min, max). */
    int(min, max) {
      return Math.floor(this.range(min, max));
    },
    /** Pick one element of an array. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}
