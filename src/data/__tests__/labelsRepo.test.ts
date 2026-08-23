import { beforeEach, describe, expect, it } from 'vitest'
import { resetDBForTests } from '../db'
import { archiveLabel, createLabel, isLabelInUse, listLabels, renameLabel } from '../labelsRepo'
import { archiveProduct, createProduct } from '../productsRepo'

beforeEach(async () => {
  await resetDBForTests()
})

describe('labelsRepo', () => {
  it('creates and lists labels, excluding archived by default', async () => {
    await createLabel('Burgers')
    const sausages = await createLabel('Sausages')
    await archiveLabel(sausages.id)

    expect((await listLabels()).map((l) => l.name)).toEqual(['Burgers'])
    expect(await listLabels(true)).toHaveLength(2)
  })

  it('renames a label', async () => {
    const label = await createLabel('Burgers')
    await renameLabel(label.id, 'Beef burgers')
    const [renamed] = await listLabels()
    expect(renamed.name).toBe('Beef burgers')
  })

  it('reports whether a label is referenced by a non-archived product', async () => {
    const label = await createLabel('Burgers')
    expect(await isLabelInUse(label.id)).toBe(false)

    const product = await createProduct('Kaasburger', 'discrete', label.id)
    expect(await isLabelInUse(label.id)).toBe(true)

    await archiveProduct(product.id)
    expect(await isLabelInUse(label.id)).toBe(false)
  })
})
