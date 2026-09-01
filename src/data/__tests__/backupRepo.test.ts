import { beforeEach, describe, expect, it } from 'vitest'
import { resetDBForTests } from '../db'
import { exportBackup, importBackup, parseBackup } from '../backupRepo'
import { createLabel, listLabels } from '../labelsRepo'
import { createProduct, listProducts } from '../productsRepo'
import { addTopup, getEventsForProduct } from '../eventsRepo'

beforeEach(async () => {
  await resetDBForTests()
})

describe('backupRepo', () => {
  it('round-trips labels, products, and events through export/import', async () => {
    const label = await createLabel('Burgers')
    const product = await createProduct('Kaasburger', 'discrete', label.id)
    await addTopup(product.id, { productionDate: '2026-08-20', addedQty: 10 })

    const backup = await exportBackup()

    await resetDBForTests()
    expect(await listLabels()).toHaveLength(0)

    await importBackup(backup)

    expect((await listLabels()).map((l) => l.name)).toEqual(['Burgers'])
    expect((await listProducts()).map((p) => p.name)).toEqual(['Kaasburger'])
    const events = await getEventsForProduct(product.id)
    expect(events).toHaveLength(1)
    expect(events[0].payload).toEqual({ productionDate: '2026-08-20', addedQty: 10 })
  })

  it('replaces existing data rather than merging on import', async () => {
    await createLabel('Old label')
    const backup = await exportBackup()
    backup.labels = [{ id: 'new-id', name: 'New label', archived: false, createdAt: '2026-08-20T00:00:00.000Z' }]

    await importBackup(backup)

    expect((await listLabels()).map((l) => l.name)).toEqual(['New label'])
  })

  it('rejects a file that is not valid JSON', () => {
    expect(() => parseBackup('not json')).toThrow('Not a valid JSON file.')
  })

  it('rejects JSON that does not look like a backup', () => {
    expect(() => parseBackup(JSON.stringify({ foo: 'bar' }))).toThrow('does not look like a Stock Tracker backup')
  })

  it('accepts a well-formed backup payload', () => {
    const parsed = parseBackup(JSON.stringify({ version: 2, exportedAt: 'x', labels: [], products: [], events: [] }))
    expect(parsed.labels).toEqual([])
  })

  it('rejects a backup with no recognizable version', () => {
    expect(() =>
      parseBackup(JSON.stringify({ exportedAt: 'x', labels: [], products: [], events: [] })),
    ).toThrow('does not look like a Stock Tracker backup')
  })

  it('rejects a backup made by a newer app version', () => {
    expect(() =>
      parseBackup(JSON.stringify({ version: 99, exportedAt: 'x', labels: [], products: [], events: [] })),
    ).toThrow('newer version of the app')
  })

  it('backfills sourceType/lifespanDays/layerSize on products from a v1 backup', () => {
    const parsed = parseBackup(
      JSON.stringify({
        version: 1,
        exportedAt: 'x',
        labels: [],
        products: [{ id: 'p1', name: 'Oude worst', category: 'discrete', labelId: null, archived: false, createdAt: 'x' }],
        events: [],
      }),
    )
    expect(parsed.products[0]).toMatchObject({ sourceType: 'in house', lifespanDays: null, layerSize: null })
  })
})
