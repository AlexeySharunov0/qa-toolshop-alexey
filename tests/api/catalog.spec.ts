import { expect, test } from '../../src/fixtures/test';

/**
 * TC-03 / TC-04 / TC-05 / TC-06 (see TEST_CASES.md).
 *
 * Catalogue checks are written as invariants over the whole response rather
 * than "there are some products". An invariant catches the real class of bug
 * (a filter that is ignored, a sort that is applied in the wrong direction)
 * while staying stable when seed data changes.
 */
test.describe('Catalogue - search, filter, sort', () => {
  test('search returns only products whose name matches the term', async ({ api }) => {
    const term = 'hammer';
    const results = await api.products({ q: term });

    expect(results.length, 'search for "hammer" returns something').toBeGreaterThan(0);

    const nonMatching = results.filter((p) => !p.name.toLowerCase().includes(term));
    expect(
      nonMatching.map((p) => p.name),
      'every returned product name contains the search term',
    ).toEqual([]);
  });

  test('search for a term that cannot exist returns an empty list, not an error', async ({
    api,
  }) => {
    const res = await api.products({ q: 'zzz-no-such-product-zzz' });
    expect(res, 'no matches is an empty result').toHaveLength(0);
  });

  test('price-range filter and price sort are both applied', async ({ api }) => {
    const min = 10;
    const max = 60;

    const results = await api.products({
      between: `price,${min},${max}`,
      sort: 'price,desc',
    });

    expect(results.length, 'the range returns products').toBeGreaterThan(1);

    // Invariant 1: nothing outside the requested range leaks through.
    const outOfRange = results.filter((p) => Number(p.price) < min || Number(p.price) > max);
    expect(
      outOfRange.map((p) => `${p.name}=${p.price}`),
      `all prices are within ${min}..${max}`,
    ).toEqual([]);

    // Invariant 2: the requested order is actually applied.
    const prices = results.map((p) => Number(p.price));
    const sortedDesc = [...prices].sort((a, b) => b - a);
    expect(prices, 'results are ordered by price descending').toEqual(sortedDesc);
  });

  test('non-existent product returns 404 instead of an empty object', async ({ api }) => {
    const res = await api.product('01ZZZZZZZZZZZZZZZZZZZZZZZZ');
    expect(res.status, 'unknown product id is a 404').toBe(404);
  });
});
