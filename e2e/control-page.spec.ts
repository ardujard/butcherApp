import { expect, test, type Locator, type Page } from '@playwright/test'
import { dayLabel, openControlPage, seedDemoData } from './seed'

/** The dated rows on a product's control page, newest date first. */
function rows(page: Page): Locator {
  return page.locator('.composition-list .composition-row')
}

/** A batch row, found by the day it was topped up. */
function row(page: Page, openedOffset: number): Locator {
  return rows(page).filter({ hasText: `aangevuld op ${dayLabel(openedOffset)}` })
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

  await test.step('rows run oldest top-up first', async () => {
    await expect(rows(page).locator('.topup-line')).toHaveText([
      `aangevuld op ${dayLabel(-4)}`,
      `aangevuld op ${dayLabel(-2)}`,
      `aangevuld op ${dayLabel(0)}`,
      `aangevuld op ${dayLabel(0)}`,
    ])
  })

  await test.step('the pack good until next month is the one in trouble', async () => {
    const overdue = row(page, -4)
    await expect(overdue).toHaveClass(/lifespan-exceeded/)
    await expect(overdue.locator('.batch-detail')).toHaveText(
      `Originele houdbaarheidsdatum: ${dayLabel(46)}, moest 1 dag geleden al uit de toog`,
    )
  })

  await test.step('a pack good even later is down to its last day out', async () => {
    const warning = row(page, -2)
    await expect(warning).toHaveClass(/lifespan-warning/)
    await expect(warning.locator('.batch-detail')).toHaveText(
      `Originele houdbaarheidsdatum: ${dayLabel(64)}, kan nog 1 dag in de toog blijven liggen`,
    )
  })

  await test.step('one opened today still has its full counter window', async () => {
    const fresh = rows(page).filter({ hasText: `Originele houdbaarheidsdatum: ${dayLabel(90)}` })
    await expect(fresh).toHaveClass(/lifespan-ok/)
    await expect(fresh.locator('.batch-detail')).toHaveText(
      `Originele houdbaarheidsdatum: ${dayLabel(90)}, kan nog 3 dagen in de toog blijven liggen`,
    )
  })

  await test.step('a pack whose good-till date falls inside the window is bound by that instead', async () => {
    const shelfBound = rows(page).filter({ hasText: `Originele houdbaarheidsdatum: ${dayLabel(2)}` })
    await expect(shelfBound.locator('.batch-detail')).toHaveText(
      `Originele houdbaarheidsdatum: ${dayLabel(2)}, kan nog 2 dagen in de toog blijven liggen`,
    )
  })

  await shot(page, 'external-with-counter-window')
})

test('refilling one good-till date twice merges into one row, dated by the earlier top-up', async ({ page }) => {
  await openControlPage(page, 'Rookworst voorverpakt')

  await expect(rows(page)).toHaveCount(1)
  const merged = row(page, -4)
  await expect(merged.locator('.qty')).toHaveText('15')
  await expect(merged).toHaveClass(/lifespan-exceeded/)
  await expect(merged.locator('.batch-detail')).toHaveText(
    `Originele houdbaarheidsdatum: ${dayLabel(50)}, moest 1 dag geleden al uit de toog`,
  )

  await shot(page, 'merged-batch')
})

test('an external product with no counter window names its good-till date and stops there', async ({ page }) => {
  await openControlPage(page, 'Zalmsalade ingekocht')

  await expect(row(page, -5).locator('.batch-detail')).toHaveText(
    `Originele houdbaarheidsdatum: ${dayLabel(-1)}`,
  )
  await expect(row(page, -5)).toHaveClass(/lifespan-exceeded/)
  await expect(row(page, -2).locator('.batch-detail')).toHaveText(
    `Originele houdbaarheidsdatum: ${dayLabel(42)}`,
  )

  await shot(page, 'external-good-till-only')
})

test('in-house stock counts its lifespan from the production date', async ({ page }) => {
  await openControlPage(page, 'Gehakt eigen productie')

  await expect(row(page, -4).locator('.batch-detail')).toHaveText(
    `Productiedatum: ${dayLabel(-4)}, moest 1 dag geleden al uit de toog`,
  )
  await expect(row(page, -2)).toHaveClass(/lifespan-warning/)
  await expect(row(page, 0).locator('.batch-detail')).toHaveText(
    `Productiedatum: ${dayLabel(0)}, kan nog 3 dagen in de toog blijven liggen`,
  )

  await shot(page, 'in-house')
})

test('a product with no limit set stays uncoloured and says nothing about the counter', async ({ page }) => {
  await openControlPage(page, 'Braadworst eigen')

  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).first()).not.toHaveClass(/lifespan-/)
  await expect(row(page, -3).locator('.batch-detail')).toHaveText(`Productiedatum: ${dayLabel(-3)}`)

  await shot(page, 'no-limit')
})

test('a bulk product carries the counter window across its diluted shares', async ({ page }) => {
  await openControlPage(page, 'Huzarensalade bak')

  const stale = row(page, -3)
  await expect(stale.locator('.qty')).toHaveText('60%')
  await expect(stale).toHaveClass(/lifespan-exceeded/)

  const fresh = row(page, 0)
  await expect(fresh.locator('.qty')).toHaveText('40%')
  await expect(fresh.locator('.batch-detail')).toHaveText(
    `Originele houdbaarheidsdatum: ${dayLabel(70)}, kan nog 2 dagen in de toog blijven liggen`,
  )

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

test('each oldest-stock row explains itself when its info corner is tapped', async ({ page }) => {
  await page.getByRole('button', { name: 'Controleer' }).click()
  await page.getByRole('button', { name: 'Oldest stock' }).click()
  await page.getByRole('button', { name: 'Closest to expiring' }).click()

  await test.step('a counter-bound pack names both its dates', async () => {
    await page.getByRole('button', { name: /Waarom staat Kipfilet/ }).click()
    await expect(page.locator('.info-panel')).toHaveText(
      `Dit product werd aangevuld op ${dayLabel(-4)} en staat ingesteld op max 3 dagen in de toog, ` +
        `dus tot ${dayLabel(-1)}. De houdbaarheidsdatum van de verpakking was ${dayLabel(46)}.`,
    )
  })

  await shot(page, 'info-panel')

  await test.step('only one explanation is open at a time', async () => {
    await page.getByRole('button', { name: /Waarom staat Gehakt/ }).click()
    await expect(page.locator('.info-panel')).toHaveCount(1)
    await expect(page.locator('.info-panel')).toHaveText(
      `Dit product is geproduceerd op ${dayLabel(-4)} en is 3 dagen houdbaar, dus tot ${dayLabel(-1)}.`,
    )
  })

  await test.step('tapping the same corner again closes it', async () => {
    await page.getByRole('button', { name: /Waarom staat Gehakt/ }).click()
    await expect(page.locator('.info-panel')).toHaveCount(0)
  })

  await test.step('a product with nothing tracked has no info corner', async () => {
    const untracked = page.locator('.composition-row').filter({ hasText: 'Braadworst eigen' })
    await expect(untracked.locator('.info-button')).toHaveCount(0)
  })
})
