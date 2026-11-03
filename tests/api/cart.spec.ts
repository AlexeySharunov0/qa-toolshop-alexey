import { expect, test } from '../../src/fixtures/test';

/**
 * TC-07 / TC-08 / TC-09 / TC-10 (see TEST_CASES.md).
 *
 * Cart rules that are easy to break and expensive to miss: quantity changes
 * must be recalculated server-side, and the documented "one Thor Hammer per
 * cart" business rule must hold.
 */
test.describe('Cart', () => {
  test('quantity update and removal are reflected in the stored cart', async ({
    api,
    authed,
    product,
  }) => {
    const { token } = authed;
    const cartId = await api.createCart(token);
    await api.addToCart(token, cartId, product.id, 1);

    const updated = await api.updateQuantity(token, cartId, product.id, 4);
    expect(updated.status, 'PUT /carts/{id}/product/quantity').toBe(200);

    const cart = await api.getCart(token, cartId);
    const line = cart.body.cart_items.find((item) => item.product_id === product.id);
    expect(line?.quantity, 'new quantity is persisted').toBe(4);

    const removed = await api.removeFromCart(token, cartId, product.id);
    expect(removed.status).toBeOneOf([200, 204]);

    const emptied = await api.getCart(token, cartId);
    expect(emptied.body.cart_items, 'cart has no line for the removed product').toHaveLength(0);
  });

  test('adding the same product twice merges it into one line', async ({ api, authed, product }) => {
    const { token } = authed;
    const cartId = await api.createCart(token);

    await api.addToCart(token, cartId, product.id, 2);
    await api.addToCart(token, cartId, product.id, 3);

    const cart = await api.getCart(token, cartId);
    const lines = cart.body.cart_items.filter((item) => item.product_id === product.id);

    expect(lines, 'one product never produces two cart lines').toHaveLength(1);
    expect(lines[0].quantity, 'quantities are summed').toBe(5);
  });

  test('Thor Hammer business rule: only one per cart', async ({ api, authed }) => {
    const { token } = authed;
    const catalogue = await api.products({ q: 'Thor Hammer' });
    const hammer = catalogue.find((p) => p.name === 'Thor Hammer');
    expect(hammer, 'Thor Hammer exists in the seeded catalogue').toBeDefined();

    const cartId = await api.createCart(token);

    // First one is accepted.
    const first = await api.addToCart(token, cartId, hammer!.id, 1);
    expect(first.status, 'a single Thor Hammer is allowed').toBe(200);

    // A second attempt must be rejected and must not silently change the cart.
    const second = await api.addToCart(token, cartId, hammer!.id, 1);
    expect(
      second.status,
      'adding a second Thor Hammer is rejected with a 4xx, not a 5xx',
    ).toBeWithin(400, 499);

    const cart = await api.getCart(token, cartId);
    const hammerLines = cart.body.cart_items.filter((item) => item.product_id === hammer!.id);
    expect(hammerLines, 'cart still contains exactly one Thor Hammer line').toHaveLength(1);
    expect(hammerLines[0].quantity, 'quantity was not incremented').toBe(1);
  });

  test('cart rejects a quantity of zero or below', async ({ api, authed, product }) => {
    const { token } = authed;
    const cartId = await api.createCart(token);

    const zero = await api.addToCart(token, cartId, product.id, 0);
    expect(zero.status, 'quantity=0 must be rejected').toBeWithin(400, 499);

    const negative = await api.addToCart(token, cartId, product.id, -2);
    expect(negative.status, 'negative quantity must be rejected').toBeWithin(400, 499);

    const cart = await api.getCart(token, cartId);
    expect(cart.body.cart_items, 'rejected requests did not modify the cart').toHaveLength(0);
  });
});
