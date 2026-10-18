import type { Page } from '@playwright/test'
// @ts-expect-error - plain JS module, also used as a CLI to emit a backup file
import { buildDemoData } from '../scripts/demo-data.mjs'

/** Replaces everything in the app's IndexedDB with the demo stock, then
 * reloads so React reads the new data. */
export async function seedDemoData(page: Page): Promise<void> {
  await page.goto('/')
  // The home screen never touches storage. Opening a product list is what
  // makes the app create and upgrade its schema, and the seed can only
  // overwrite stores that already exist.
  await page.getByRole('button', { name: 'Controleer' }).click()
  await page.waitForFunction(
    async () => (await indexedDB.databases()).some((d) => d.name === 'butcherApp' && (d.version ?? 0) >= 2),
  )

  await page.evaluate(async (data) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('butcherApp')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const tx = db.transaction(['labels', 'products', 'events'], 'readwrite')
    for (const [store, rows] of [
      ['labels', data.labels],
      ['products', data.products],
      ['events', data.events],
    ] as const) {
      const os = tx.objectStore(store)
      os.clear()
      for (const row of rows) os.put(row)
    }
    await new Promise((resolve) => {
      tx.oncomplete = resolve
    })
    db.close()
  }, buildDemoData())

  await page.reload()
  await page.waitForSelector('.home-tile')
}

/** 'dd/mm' for a day offset from today, matching how the app labels dates.
 * Computed here independently of the app's own date helpers, so a bug in
 * those can't quietly agree with itself. */
export function dayLabel(offset: number): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function openControlPage(page: Page, productName: string): Promise<void> {
  await page.getByRole('button', { name: 'Controleer' }).click()
  await page.getByRole('button', { name: productName }).click()
  await page.waitForSelector('.composition-row')
}
