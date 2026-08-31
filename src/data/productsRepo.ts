import type { Category, Product, SourceType } from '../domain/types'
import { getDB } from './db'
import { newId } from './id'

export async function listProducts(includeArchived = false): Promise<Product[]> {
  const db = await getDB()
  const all = await db.getAll('products')
  return includeArchived ? all : all.filter((p) => !p.archived)
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDB()
  return db.get('products', id)
}

export async function createProduct(
  name: string,
  category: Category,
  labelId: string | null,
  sourceType: SourceType = 'in house',
  lifespanDays: number | null = null,
  layerSize: number | null = null,
): Promise<Product> {
  const db = await getDB()
  const product: Product = {
    id: newId(),
    name,
    category,
    labelId,
    sourceType,
    lifespanDays,
    layerSize,
    archived: false,
    createdAt: new Date().toISOString(),
  }
  await db.add('products', product)
  return product
}

export async function renameProduct(id: string, name: string, labelId: string | null): Promise<void> {
  const db = await getDB()
  const product = await db.get('products', id)
  if (!product) throw new Error(`Product ${id} not found`)
  await db.put('products', { ...product, name, labelId })
}

export async function updateProductSettings(
  id: string,
  sourceType: SourceType,
  lifespanDays: number | null,
  layerSize: number | null,
): Promise<void> {
  const db = await getDB()
  const product = await db.get('products', id)
  if (!product) throw new Error(`Product ${id} not found`)
  await db.put('products', { ...product, sourceType, lifespanDays, layerSize })
}

export async function archiveProduct(id: string): Promise<void> {
  const db = await getDB()
  const product = await db.get('products', id)
  if (!product) throw new Error(`Product ${id} not found`)
  await db.put('products', { ...product, archived: true })
}

export async function restoreProduct(id: string): Promise<void> {
  const db = await getDB()
  const product = await db.get('products', id)
  if (!product) throw new Error(`Product ${id} not found`)
  await db.put('products', { ...product, archived: false })
}
