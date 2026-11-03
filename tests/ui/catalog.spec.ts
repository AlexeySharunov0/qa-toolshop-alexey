import { expect, test } from '../../src/fixtures/test';

/**
 * TC-18 / TC-19 (see TEST_CASES.md).
 *
 * Catalogue behaviour from the user's point of view. Assertions check what the
 * user actually sees in the result list, not merely that the grid rendered.
 */
test.describe('Catalogue UI', () => {
  test('search narrows the list to matching products and reset restores it', async ({ page }) => {
    await page.goto('/');

    const names = page.getByTestId('product-name');
    await expect(names.first(), 'the overview lists products').toBeVisible();

    const initialCount = await names.count();
    expect(initialCount).toBeGreaterThan(0);

    await page.getByTestId('search-query').fill('hammer');
    await page.getByTestId('search-submit').click();

    await expect(page.getByTestId('search-term')).toHaveText('hammer');
    await expect(names.first()).toBeVisible();

    // The result counter is rendered before the grid is replaced, so wait for
    // the grid itself to settle instead of sampling it once.
    await expect
      .poll(
        async () =>
          (await names.allInnerTexts()).filter((name) => !name.toLowerCase().includes('hammer')),
        { message: 'every visible product matches the search term', timeout: 15_000 },
      )
      .toEqual([]);

    const matchingCount = await names.count();
    expect(matchingCount, 'search returns at least one product').toBeGreaterThan(0);

    // Reset must bring the unfiltered list back.
    await page.getByTestId('search-reset').click();
    await expect(page.getByTestId('search-caption')).toHaveCount(0);
    await expect
      .poll(async () => names.count(), { message: 'full list is visible again' })
      .toBeGreaterThan(matchingCount);
  });

  test('sorting by price descending orders the visible products', async ({ page }) => {
    await page.goto('/');

    const prices = page.locator('[data-test="product-price"]');
    await expect(prices.first()).toBeVisible();

    await page.getByTestId('sort').selectOption({ label: 'Price (High - Low)' });

    const readPrices = async (): Promise<number[]> =>
      (await prices.allInnerTexts())
        .map((text) => Number(text.replace(/[^0-9.]/g, '')))
        .filter((value) => !Number.isNaN(value));

    // The grid is replaced asynchronously: wait for the ordering to settle
    // instead of sampling it once right after the click.
    await expect
      .poll(
        async () => {
          const shown = await readPrices();
          if (shown.length < 2) return false;
          const sortedDesc = [...shown].sort((a, b) => b - a);
          return JSON.stringify(shown) === JSON.stringify(sortedDesc);
        },
        { message: 'products are ordered from the most expensive', timeout: 15_000 },
      )
      .toBe(true);
  });
});
