import { expect, test, type Locator, type Page } from '@playwright/test'
import { dayLabel, openControlPage, seedDemoData } from './seed'

/** The dated rows on a product's control page, newest date first. */
function rows(page: Page): Locator {
  return page.locator('.composition-list .composition-row')
}

function row(page: Page, date: string): Locator {
  return rows(page).filter({ hasText: date })
}

async function shot(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot(), contentType: 'image/png' })
}

test.beforeEach(async ({ page }) => {
  await seedDemoData(page)
})

test('a sealed pack is flagged once its counter window runs out, long before its good-till date', async ({
  page,
}) => {
  await openControlPage(page, 'Kipfilet voorverpakt')

  await test.step('the pack good until next month is the one in trouble', async () => {
    const overdue = row(page, dayLabel(46))
    await expect(overdue).toHaveClass(/lifespan-exceeded/)
    await expect(overdue.locator('.expiry-note')).toHaveText('toonbank · 1 dag te laat')
  })

  await test.step('a pack good even later is only one day off the counter limit', async () => {
    const warning = row(page, dayLabel(64))
    await expect(warning).toHaveClass(/lifespan-warning/)
    await expect(warning.locator('.expiry-note')).toHaveText('toonbank t/m morgen')
  })

  await test.step('one opened today still has its full counter window', async () => {
    const fresh = row(page, dayLabel(90))
    await expect(fresh).toHaveClass(/lifespan-ok/)
    await expect(fresh.locator('.expiry-note')).toHaveText(`toonbank t/m ${dayLabel(3)} · nog 3 dagen`)
  })

  await test.step('a pack whose good-till date falls inside the window is bound by that instead', async () => {
    const shelfBound = row(page, dayLabel(2))
    await expect(shelfBound).toHaveClass(/lifespan-ok/)
    await expect(shelfBound.locator('.expiry-note')).toHaveText('houdbaar · nog 2 dagen')
  })

  await shot(page, 'external-with-counter-window')
})

test('refilling one good-till date twice runs the counter from the earlier top-up', async ({ page }) => {
  await openControlPage(page, 'Rookworst voorverpakt')

  const merged = row(page, dayLabel(50))
  await expect(merged.locator('.qty')).toHaveText('15')
  await expect(merged).toHaveClass(/lifespan-exceeded/)
  await expect(merged.locator('.expiry-note')).toHaveText('toonbank · 1 dag te laat')

  await shot(page, 'merged-batch')
})

test('an external product with no counter window still runs on its good-till date alone', async ({ page }) => {
  await openControlPage(page, 'Zalmsalade ingekocht')

  await expect(row(page, dayLabel(42)).locator('.expiry-note')).toHaveText('houdbaar · nog 42 dagen')
  const expired = row(page, dayLabel(-1))
  await expect(expired).toHaveClass(/lifespan-exceeded/)
  await expect(expired.locator('.expiry-note')).toHaveText('houdbaar · 1 dag te laat')

  await shot(page, 'external-good-till-only')
})

test('in-house stock still counts its lifespan from the production date', async ({ page }) => {
  await openControlPage(page, 'Gehakt eigen productie')

  await expect(page.locator('.hint-note')).toHaveText('Datums hieronder zijn productiedatums.')
  // Today's batch is labelled 'Today' rather than a date, so it is matched on that.
  await expect(row(page, 'Today').locator('.expiry-note')).toHaveText(
    `houdbaar t/m ${dayLabel(3)} · nog 3 dagen`,
  )
  await expect(row(page, dayLabel(-2))).toHaveClass(/lifespan-warning/)
  await expect(row(page, dayLabel(-4))).toHaveClass(/lifespan-exceeded/)

  await shot(page, 'in-house')
})

test('a product with no limit set stays uncoloured and unannotated', async ({ page }) => {
  await openControlPage(page, 'Braadworst eigen')

  await expect(rows(page)).toHaveCount(2)
  await expect(page.locator('.expiry-note')).toHaveCount(0)
  await expect(rows(page).first()).not.toHaveClass(/lifespan-/)

  await shot(page, 'no-limit')
})

test('a bulk product carries the counter window across its diluted shares', async ({ page }) => {
  await openControlPage(page, 'Huzarensalade bak')

  const fresh = row(page, dayLabel(70))
  await expect(fresh.locator('.qty')).toHaveText('40%')
  await expect(fresh.locator('.expiry-note')).toHaveText(`toonbank t/m ${dayLabel(2)} · nog 2 dagen`)

  const stale = row(page, dayLabel(60))
  await expect(stale.locator('.qty')).toHaveText('60%')
  await expect(stale).toHaveClass(/lifespan-exceeded/)

  await shot(page, 'bulk')
})

test('the oldest-stock dashboard ranks on the real deadline and names which limit it is', async ({ page }) => {
  await page.getByRole('button', { name: 'Controleer' }).click()
  await page.getByRole('button', { name: 'Oldest stock' }).click()
  await page.getByRole('button', { name: 'Closest to expiring' }).click()

  await test.step('the sealed pack is listed by its counter deadline, not its good-till date', async () => {
    const kipfilet = page.locator('.composition-row').filter({ hasText: 'Kipfilet voorverpakt' })
    await expect(kipfilet.locator('.expiry-note')).toHaveText('toonbank')
    await expect(kipfilet.locator('.qty')).toHaveText(dayLabel(-1))
    await expect(kipfilet).toHaveClass(/lifespan-exceeded/)
  })

  await test.step('products with nothing tracked sort last and carry no tag', async () => {
    const untracked = page.locator('.composition-row').filter({ hasText: 'Braadworst eigen' })
    await expect(untracked.locator('.expiry-note')).toHaveCount(0)
    await expect(page.locator('.composition-row').last()).toContainText('Braadworst eigen')
  })

  await shot(page, 'dashboard')
})
