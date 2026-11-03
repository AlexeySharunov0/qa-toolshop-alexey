import { expect, test } from '../../src/fixtures/test';
import { billingFromLookup, buildCustomer, buildInvoicePayload } from '../../src/data/factories';

/**
 * Regression tests for defects that were reproduced manually and documented in
 * BUGS.md (test cases TC-20 … TC-24).
 *
 * Each test asserts the behaviour the product *should* have. The mismatch is
 * real, so `test.fail()` is called inside the test body: Playwright marks it as
 * an expected failure instead of hiding it.
 *
 * If a defect gets fixed the test starts passing, Playwright reports
 * "expected to fail but passed", and the `test.fail()` line can be removed.
 *
 * Expected failures are listed in README.md ("Ожидаемые падения").
 */
test.describe('Known defects @known-defect', () => {
  test('BUG-01 a product with zero stock cannot be ordered', async ({ api, authed }) => {
    test.fail(true, 'BUG-01: out-of-stock product can be added to the cart and ordered');

    const { token } = authed;

    // "Long Nose Pliers" is seeded with stock = 0 and advertised as in_stock:false.
    const catalogue = await api.products({ q: 'Long Nose Pliers' });
    const outOfStock = catalogue.find((p) => p.name === 'Long Nose Pliers');
    expect(outOfStock, 'seeded catalogue contains an out-of-stock product').toBeDefined();
    expect(outOfStock!.in_stock, 'product is advertised as out of stock').toBe(false);

    const cartId = await api.createCart(token);
    const add = await api.addToCart(token, cartId, outOfStock!.id, 1);
    expect(add.status, 'adding an out-of-stock product is rejected').toBeWithin(400, 499);

    const billing = await billingFromLookup(api);
    const order = await api.createInvoice(token, buildInvoicePayload(cartId, billing));
    expect(order.status, 'an order containing an out-of-stock product is rejected').toBeWithin(
      400,
      499,
    );
  });

  test('BUG-02 cart quantity is limited by available stock', async ({ api, authed }) => {
    test.fail(true, 'BUG-02: ordering more units than available stock is accepted (25 in stock, 26 ordered)');

    const { token } = authed;

    // The seeder gives hand tools stock = 25, so 26 units cannot be fulfilled.
    // The cart API cap is 99, so 26 is a legitimate request that still exceeds
    // the available quantity.
    const catalogue = await api.products({ q: 'Washers' });
    const product = catalogue.find((p) => p.name === 'Washers');
    expect(product, 'seeded catalogue contains "Washers"').toBeDefined();

    const cartId = await api.createCart(token);
    const add = await api.addToCart(token, cartId, product!.id, 26);
    expect(add.status, 'adding more units than exist is rejected').toBeWithin(400, 499);

    const billing = await billingFromLookup(api);
    const order = await api.createInvoice(token, buildInvoicePayload(cartId, billing));
    expect(order.status, 'an order exceeding stock is rejected').toBeWithin(400, 499);
  });

  test('BUG-03 an empty cart cannot be turned into an order', async ({ api, authed }) => {
    test.fail(true, 'BUG-03: an empty cart can be turned into an order with total 0');

    const { token } = authed;

    const cartId = await api.createCart(token);
    const cart = await api.getCart(token, cartId);
    expect(cart.body.cart_items, 'the cart is empty').toHaveLength(0);

    const billing = await billingFromLookup(api);
    const order = await api.createInvoice(token, buildInvoicePayload(cartId, billing));
    expect(order.status, 'checkout with an empty cart is rejected').toBeWithin(400, 499);
  });

  test("BUG-04 another customer's cart cannot be consumed", async ({ api, authed }) => {
    test.fail(true, 'BUG-04: any authenticated customer can place an order from any cart id');

    const { token: ownerToken } = authed;

    const catalogue = await api.products({ between: 'price,1,200', sort: 'price,asc' });
    const product = catalogue[0];

    const cartId = await api.createCart(ownerToken);
    await api.addToCart(ownerToken, cartId, product.id, 1);

    const stranger = await api.registerAndLogin(buildCustomer());

    const billing = await billingFromLookup(api);
    const asStranger = await api.createInvoice(
      stranger.token,
      buildInvoicePayload(cartId, billing),
    );
    expect(
      asStranger.status,
      "another customer's cart is not payable (403/404, not 201)",
    ).toBeWithin(400, 499);
  });
});
