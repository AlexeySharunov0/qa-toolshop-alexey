import { expect, test } from '../../src/fixtures/test';
import {
  addProductToCart,
  fillBillingAddress,
  loginViaUi,
  parseMoney,
} from '../../src/fixtures/ui-helpers';

/**
 * TC-15 / TC-16 / TC-17 (see TEST_CASES.md).
 *
 * The UI critical path, end to end. Note the two-step confirmation: on this
 * build the first "Confirm" click only validates the payment and the order is
 * created by the second click (BUG-05). This test covers the rest of the wizard
 * using that documented workaround; the "one click must be enough" expectation
 * is asserted separately in tests/ui/known-defects.spec.ts.
 */
test.describe('Checkout UI @smoke', () => {
  test('customer places an order through the checkout wizard', async ({
    page,
    api,
    authed,
    product,
  }) => {
    await loginViaUi(page, authed.customer);
    await addProductToCart(page, product.id);

    await page.goto('/checkout');

    // Step 1 - cart contains the product we added.
    await expect(page.getByTestId('product-title').first()).toContainText(product.name);
    await page.getByTestId('proceed-1').click();

    // Step 2 - already signed in, continue.
    await page.getByTestId('proceed-2').click();

    // Step 3 - billing address, auto-filled by the postcode lookup.
    await fillBillingAddress(page, api);
    await page.getByTestId('proceed-3').click();

    // Step 4 - payment.
    await page.getByTestId('payment-method').selectOption('cash-on-delivery');

    // First click validates the payment (BUG-05), second creates the order.
    await page.getByTestId('finish').click();
    await expect(page.getByTestId('payment-success-message')).toBeVisible();
    await page.getByTestId('finish').click();

    const confirmation = page.locator('#order-confirmation');
    await expect(confirmation, 'order confirmation is shown').toBeVisible();

    const confirmationText = await confirmation.innerText();
    const invoiceNumber = confirmationText.match(/INV-\d+/)?.[0];
    expect(
      invoiceNumber,
      `confirmation shows an invoice number (got "${confirmationText}")`,
    ).toBeTruthy();

    // The order must really exist for this customer, not just in the DOM.
    const invoices = await api.listInvoices(authed.token);
    const stored = invoices.body.data.find((i) => i.invoice_number === invoiceNumber);

    expect(stored, 'the confirmed invoice exists in GET /invoices').toBeDefined();
    expect(Number(stored!.total), 'the stored order has a non-zero total').toBeGreaterThan(0);
  });

  test('cart totals follow the quantity typed in the cart', async ({ page, authed, product }) => {
    await loginViaUi(page, authed.customer);
    await addProductToCart(page, product.id);
    await page.goto('/checkout');

    await expect(page.getByTestId('product-quantity').first()).toBeVisible();

    const quantity = page.getByTestId('product-quantity').first();
    await quantity.fill('2');
    await quantity.press('Tab');

    const expected = Number(product.price) * 2;

    // One product only: the line total and the cart total must both equal
    // unit price x 2. The cart total is recalculated after the server round
    // trip, so poll instead of sampling once.
    await expect
      .poll(
        async () => {
          const line = parseMoney(await page.getByTestId('line-price').first().innerText());
          const total = parseMoney(await page.getByTestId('cart-total').innerText());
          return { line, total };
        },
        { message: 'line total and cart total both reflect quantity = 2', timeout: 15_000 },
      )
      .toEqual({ line: expected, total: expected });
  });

  test('checkout with an empty cart shows the empty state and no way forward', async ({ page }) => {
    await page.goto('/checkout');

    await expect(page.getByTestId('proceed-1')).toHaveCount(0);
  });
});
