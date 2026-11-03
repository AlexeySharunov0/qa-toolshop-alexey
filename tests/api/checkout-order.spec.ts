import { expect, test } from '../../src/fixtures/test';
import { billingFromLookup, buildInvoicePayload } from '../../src/data/factories';

/**
 * TC-01 / TC-02 (see TEST_CASES.md).
 *
 * The critical path of the whole scope: an authenticated customer puts a
 * product in the cart and turns it into an order. Assertions check the stored
 * *result* (amount, quantities, payment method, invoice number), not just that
 * the API answered 2xx somewhere along the way.
 */
test.describe('Checkout - order creation @smoke', () => {
  test('customer can place an order and reads it back with the same totals', async ({
    api,
    authed,
    product,
  }) => {
    const { token } = authed;
    const quantity = 2;

    // --- arrange: cart with a known product -------------------------------
    const cartId = await api.createCart(token);
    expect(cartId, 'cart id returned by POST /carts').toBeTruthy();

    const added = await api.addToCart(token, cartId, product.id, quantity);
    expect(added.status, 'POST /carts/{id} adds the item').toBe(200);

    const cart = await api.getCart(token, cartId);
    expect(cart.status).toBe(200);
    expect(cart.body.cart_items, 'cart holds exactly the one product we added').toHaveLength(1);

    const line = cart.body.cart_items[0];
    expect(line.product.id).toBe(product.id);
    expect(line.quantity, 'requested quantity is persisted').toBe(quantity);

    const unitPrice = Number(line.discounted_price ?? line.product.price);
    const expectedTotal = Number((unitPrice * quantity).toFixed(2));

    // --- act: payment check, then the order itself ------------------------
    const payment = await api.checkPayment('cash-on-delivery');
    expect(payment.status, 'POST /payment/check for cash on delivery').toBe(200);

    const billing = await billingFromLookup(api);
    const created = await api.createInvoice(token, buildInvoicePayload(cartId, billing));
    expect(created.status, 'POST /invoices').toBe(201);
    expect(created.body.id, 'invoice id is returned').toBeTruthy();

    // --- assert: the order is stored with the amount we expect ------------
    expect(Number(created.body.total), 'order total equals unit price x quantity').toBeCloseTo(
      expectedTotal,
      2,
    );

    const fetched = await api.getInvoice(token, created.body.id);
    expect(fetched.status, 'the invoice is readable by its owner').toBe(200);
    expect(fetched.body.invoice_number, 'invoice number is persisted').toBe(
      created.body.invoice_number,
    );
    expect(Number(fetched.body.total)).toBeCloseTo(expectedTotal, 2);
    expect(fetched.body.billing_city, 'billing address is stored as submitted').toBe(
      billing.billing_city,
    );

    // The invoice line must describe what was actually bought.
    const lines = fetched.body.invoicelines ?? [];
    const lineForProduct = lines.find((l) => l.product_id === product.id);
    expect(lineForProduct, 'ordered product is present in the invoice lines').toBeDefined();
    expect(lineForProduct!.quantity, 'ordered quantity is preserved on the invoice').toBe(quantity);

    // --- assert: and it shows up in the customer's invoice list -----------
    const list = await api.listInvoices(token);
    expect(list.status).toBe(200);
    expect(
      list.body.data.map((invoice) => invoice.id),
      'new order appears in GET /invoices for its owner',
    ).toContain(created.body.id);
  });

  test('order contains exactly the products that were in the cart', async ({
    api,
    authed,
  }) => {
    const { token } = authed;
    const catalogue = (
      await api.products({ between: 'price,1,200', sort: 'price,asc' })
    ).filter((p) => p.in_stock !== false);
    const [first, second] = catalogue;
    expect(second, 'seeded catalogue has at least two products in the price range').toBeDefined();

    const cartId = await api.createCart(token);
    await api.addToCart(token, cartId, first.id, 1);
    await api.addToCart(token, cartId, second.id, 3);

    const billing = await billingFromLookup(api);
    const created = await api.createInvoice(token, buildInvoicePayload(cartId, billing));
    expect(created.status).toBe(201);

    const fetched = await api.getInvoice(token, created.body.id);
    const lines = fetched.body.invoicelines ?? [];

    expect(lines.map((l) => l.product_id).sort(), 'both cart products reached the invoice').toEqual(
      [first.id, second.id].sort(),
    );
    const secondLine = lines.find((l) => l.product_id === second.id);
    expect(secondLine!.quantity).toBe(3);

    const expectedTotal = Number(
      (Number(first.price) * 1 + Number(second.price) * 3).toFixed(2),
    );
    expect(Number(fetched.body.total)).toBeCloseTo(expectedTotal, 2);
  });
});
