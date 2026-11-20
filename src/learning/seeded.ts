// A repeatable rng for tests: the same seed gives the same shuffles and picks.
export const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647
