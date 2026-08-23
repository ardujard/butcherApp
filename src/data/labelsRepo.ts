import type { Label } from '../domain/types'
import { getDB } from './db'

export async function listLabels(includeArchived = false): Promise<Label[]> {
  const db = await getDB()
  const all = await db.getAll('labels')
  return includeArchived ? all : all.filter((l) => !l.archived)
}

export async function createLabel(name: string): Promise<Label> {
  const db = await getDB()
  const label: Label = { id: crypto.randomUUID(), name, archived: false, createdAt: new Date().toISOString() }
  await db.add('labels', label)
  return label
}

export async function renameLabel(id: string, name: string): Promise<void> {
  const db = await getDB()
  const label = await db.get('labels', id)
  if (!label) throw new Error(`Label ${id} not found`)
  await db.put('labels', { ...label, name })
}

export async function archiveLabel(id: string): Promise<void> {
  const db = await getDB()
  const label = await db.get('labels', id)
  if (!label) throw new Error(`Label ${id} not found`)
  await db.put('labels', { ...label, archived: true })
}

export async function restoreLabel(id: string): Promise<void> {
  const db = await getDB()
  const label = await db.get('labels', id)
  if (!label) throw new Error(`Label ${id} not found`)
  await db.put('labels', { ...label, archived: false })
}

export async function isLabelInUse(id: string): Promise<boolean> {
  const db = await getDB()
  const products = await db.getAllFromIndex('products', 'by-labelId', id)
  return products.some((p) => !p.archived)
}
