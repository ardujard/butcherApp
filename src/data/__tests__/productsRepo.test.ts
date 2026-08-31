import { beforeEach, describe, expect, it } from 'vitest'
import { resetDBForTests } from '../db'
import {
  archiveProduct,
  createProduct,
  listProducts,
  renameProduct,
  restoreProduct,
  updateProductSettings,
} from '../productsRepo'

beforeEach(async () => {
  await resetDBForTests()
})

describe('productsRepo', () => {
  it('creates and lists products, excluding archived by default', async () => {
    await createProduct('Kaasburger', 'discrete', null)
    const sauce = await createProduct('Sauce', 'bulk', null)
    await archiveProduct(sauce.id)

    expect((await listProducts()).map((p) => p.name)).toEqual(['Kaasburger'])
    expect(await listProducts(true)).toHaveLength(2)
  })

  it('restores an archived product', async () => {
    const product = await createProduct('Sauce', 'bulk', null)
    await archiveProduct(product.id)
    await restoreProduct(product.id)
    expect((await listProducts()).map((p) => p.id)).toContain(product.id)
  })

  it('renames a product and updates its label', async () => {
    const product = await createProduct('Sauce', 'bulk', null)
    await renameProduct(product.id, 'Spaghetti sauce', 'label-1')
    const [updated] = await listProducts()
    expect(updated.name).toBe('Spaghetti sauce')
    expect(updated.labelId).toBe('label-1')
  })

  it('defaults new products to in-house with no lifespan or row size tracked', async () => {
    const product = await createProduct('Sauce', 'bulk', null)
    expect(product.sourceType).toBe('in house')
    expect(product.lifespanDays).toBeNull()
    expect(product.rowSize).toBeNull()
  })

  it('creates a product with an explicit source type, lifespan, and row size', async () => {
    const product = await createProduct('Cheese', 'discrete', null, 'external', 5, 8)
    expect(product.sourceType).toBe('external')
    expect(product.lifespanDays).toBe(5)
    expect(product.rowSize).toBe(8)
  })

  it('updates a product source type, lifespan, and row size', async () => {
    const product = await createProduct('Sausages', 'discrete', null)
    await updateProductSettings(product.id, 'external', null, 12)
    const [updated] = await listProducts()
    expect(updated.sourceType).toBe('external')
    expect(updated.lifespanDays).toBeNull()
    expect(updated.rowSize).toBe(12)
  })
})
