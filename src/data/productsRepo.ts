import type { Category, Product } from '../domain/types'
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

export async function createProduct(name: string, category: Category, labelId: string | null): Promise<Product> {
  const db = await getDB()
  const product: Product = {
    id: newId(),
    name,
    category,
    labelId,
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
