<script setup lang="ts">
// stroke icons on a 24 grid, path data only so a single v-for renders all of them
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 22 })

const CIRCLE_3 = 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z'

const ICONS: Record<string, string[]> = {
  home: ['M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z'],
  pen: ['M12 19l7-7 3 3-7 7-3-3z', 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z', 'M2 2l7.6 7.6'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-8', 'M22 20H2'],
  gear: [
    CIRCLE_3,
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],
  flame: ['M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3 1-6 2-9z'],
  eye: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z', CIRCLE_3],
  pick: [
    'M5 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M16 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M5 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z',
    'M15 17.5l2 2 4-4',
  ],
  speaker: ['M11 5L6 9H2v6h4l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  shuffle: ['M16 3h5v5', 'M4 20L21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  timer: ['M12 5a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M12 9v4l2.5 1.5', 'M9 2h6'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  check: ['M5 12l5 5 9-10'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  bulb: ['M9 18h6', 'M10 22h4', 'M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z'],
  undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-4'],
  replay: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  left: ['M15 18l-6-6 6-6'],
  right: ['M9 18l6-6-6-6'],
}

const FILLED = new Set(['flame'])
</script>

<template>
  <svg
    :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true"
    :fill="FILLED.has(name) ? 'currentColor' : 'none'"
    :stroke="FILLED.has(name) ? 'none' : 'currentColor'"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
  >
    <path v-for="d in ICONS[name]" :key="d" :d="d" />
  </svg>
</template>
