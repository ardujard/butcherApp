// Demo stock covering every expiry case, shared by the Playwright walkthrough
// and by `node scripts/demo-data.mjs > demo-data.json`, which writes a file
// restorable through Settings -> Backup.
//
// Dates are always relative to the day this runs, because the whole point is
// watching deadlines fall on either side of today — a fixed fixture goes
// stale in a week and starts showing everything in red.

/** @typedef {{ id: string, name: string, category: 'discrete' | 'bulk',
 *   sourceType: 'in house' | 'external', lifespanDays: number | null,
 *   batches: [dateOffset: number, openedOffset: number, amount: number][] }} DemoSpec */

/** @type {DemoSpec[]} */
export const DEMO_SPECS = [
  {
    id: 'demo-voorverpakt',
    name: 'Kipfilet voorverpakt — toonbank 3d',
    category: 'discrete',
    sourceType: 'external',
    lifespanDays: 3,
    batches: [
      [46, -4, 6], // sealed well into next month, but four days open -> already over
      [64, -2, 10], // counter window runs out tomorrow
      [90, 0, 12], // opened today, three days of counter left
      [2, 0, 4], // good-till lands inside the counter window, so it binds instead
    ],
  },
  {
    id: 'demo-zelfde-tht',
    name: 'Rookworst voorverpakt — 2x bijgevuld, zelfde THT',
    category: 'discrete',
    sourceType: 'external',
    lifespanDays: 3,
    // One good-till date topped up on two different days merges into a single
    // batch, and the counter clock then runs from the earlier of the two.
    batches: [
      [50, -4, 5],
      [50, -1, 10],
    ],
  },
  {
    id: 'demo-geen-toonbank',
    name: 'Zalmsalade ingekocht — geen toonbanklimiet',
    category: 'discrete',
    sourceType: 'external',
    lifespanDays: null,
    batches: [
      [42, -2, 9],
      [-1, -5, 3],
    ],
  },
  {
    id: 'demo-eigen',
    name: 'Gehakt eigen productie — houdbaar 3d',
    category: 'discrete',
    sourceType: 'in house',
    lifespanDays: 3,
    batches: [
      [-4, -4, 5],
      [-2, -2, 8],
      [0, 0, 14],
    ],
  },
  {
    id: 'demo-eigen-ongelimiteerd',
    name: 'Braadworst eigen — geen houdbaarheid ingesteld',
    category: 'discrete',
    sourceType: 'in house',
    lifespanDays: null,
    batches: [
      [-3, -3, 4],
      [-1, -1, 11],
    ],
  },
  {
    id: 'demo-bulk',
    name: 'Huzarensalade bak — bulk, toonbank 2d',
    category: 'bulk',
    sourceType: 'external',
    lifespanDays: 2,
    // Bulk top-ups are shares of a full container, not deltas: the 40% added
    // today dilutes the older stock down to the remaining 60%.
    batches: [
      [60, -3, 100],
      [70, 0, 40],
    ],
  },
]

/** Builds a backup-shaped payload, with every date offset from `from`. */
export function buildDemoData(from = new Date()) {
  // Offsets count local calendar days, as the app does: 08:00 on the device's
  // own clock, so no timezone shifts a top-up onto the neighbouring day.
  const localAt = (offset) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset, 8)
  const day = (offset) => {
    const d = localAt(offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const at = (offset) => localAt(offset).toISOString()

  const events = []
  let nextId = 1
  for (const spec of DEMO_SPECS) {
    // Entered in the order they were actually topped up, so replay sees a
    // plausible history rather than one invented backwards.
    const rows = spec.batches
      .map(([dateOffset, openedOffset, amount]) => ({ dateOffset, openedOffset, amount }))
      .sort((a, b) => a.openedOffset - b.openedOffset)
    for (const row of rows) {
      events.push({
        id: nextId++,
        productId: spec.id,
        type: 'topup',
        recordedAt: at(row.openedOffset),
        payload:
          spec.category === 'bulk'
            ? { productionDate: day(row.dateOffset), addedPct: row.amount }
            : { productionDate: day(row.dateOffset), addedQty: row.amount },
      })
    }
  }

  return {
    version: 2,
    exportedAt: from.toISOString(),
    labels: [{ id: 'demo-label', name: 'Demo', archived: false, createdAt: at(-30) }],
    products: DEMO_SPECS.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      labelId: 'demo-label',
      sourceType: s.sourceType,
      lifespanDays: s.lifespanDays,
      layerSize: null,
      archived: false,
      createdAt: at(-30),
    })),
    events,
  }
}

if (process.argv[1]?.endsWith('demo-data.mjs')) {
  process.stdout.write(JSON.stringify(buildDemoData(), null, 2) + '\n')
}
