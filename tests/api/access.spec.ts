import { expect, test } from '../../src/fixtures/test';
import { billingFromLookup, buildCustomer, buildInvoicePayload } from '../../src/data/factories';

/**
 * TC-11 / TC-12 / TC-13 / TC-14 (see TEST_CASES.md).
 *
 * Access control and error handling: the parts of a CRM-adjacent product where
 * a silent failure costs the most.
 */
test.describe('Access control and error handling', () => {
  test("a customer cannot read another customer's order", async ({ api, authed }) => {
    const { token } = authed;

    // Owner places an order.
    const cartId = await api.createCart(token);
    const [product] = await api.products({ between: 'price,1,200', sort: 'price,asc' });
    await api.addToCart(token, cartId, product.id, 1);
    const billing = await billingFromLookup(api);
    const order = await api.createInvoice(token, buildInvoicePayload(cartId, billing));
    expect(order.status, 'owner can place an order').toBe(201);

    // A different, fully authenticated customer asks for the same id.
    const stranger = buildCustomer();
    const strangerSession = await api.registerAndLogin(stranger);

    const asStranger = await api.getInvoice(strangerSession.token, order.body.id);
    expect(
      asStranger.status,
      "another customer's invoice is not readable (404, not 200)",
    ).toBe(404);

    // And it must not leak through the listing endpoint either.
    const strangerList = await api.listInvoices(strangerSession.token);
    expect(
      strangerList.body.data.map((invoice) => invoice.id),
      "another customer's order is absent from the stranger's list",
    ).not.toContain(order.body.id);
  });

  test('order creation requires authentication', async ({ api }) => {
    const cartId = await api.createCart(); // carts are anonymous by design
    const billing = await billingFromLookup(api);

    const anonymous = await api.createInvoice(
      '',
      buildInvoicePayload(cartId, billing),
    );
    expect(anonymous.status, 'POST /invoices without a token is rejected').toBe(401);
  });

  test('order creation validates payment method, address and cart', async ({ api, authed }) => {
    const { token } = authed;
    const cartId = await api.createCart(token);
    const [product] = await api.products({ between: 'price,1,200', sort: 'price,asc' });
    await api.addToCart(token, cartId, product.id, 1);
    const billing = await billingFromLookup(api);

    // Unknown payment method.
    const badPayment = await api.createInvoice(token, {
      ...buildInvoicePayload(cartId, billing),
      payment_method: 'bitcoin',
    });
    expect(badPayment.status, 'unsupported payment method is a validation error').toBe(422);

    // Missing required billing field.
    const noStreet = await api.createInvoice(token, {
      ...buildInvoicePayload(cartId, billing),
      billing_street: '',
    });
    expect(noStreet.status, 'empty billing street is a validation error').toBe(422);

    // Address that contradicts the selected country.
    const wrongCity = await api.createInvoice(token, {
      ...buildInvoicePayload(cartId, billing),
      billing_city: 'Vienna',
    });
    expect(
      wrongCity.status,
      'a city that does not belong to the country/postcode is rejected',
    ).toBe(422);

    // None of the rejected attempts may create an order.
    const list = await api.listInvoices(token);
    expect(list.body.data, 'no order was created by the rejected requests').toHaveLength(0);
  });

  test('cart endpoints reject requests for a cart that does not exist', async ({
    api,
    authed,
  }) => {
    const { token } = authed;
    const res = await api.getCart(token, '01ZZZZZZZZZZZZZZZZZZZZZZZZ');
    expect(res.status, 'unknown cart id is a 404').toBe(404);
  });
});
