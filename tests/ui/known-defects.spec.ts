import { expect, test } from '../../src/fixtures/test';
import {
  addProductToCart,
  fillBillingAddress,
  loginViaUi,
} from '../../src/fixtures/ui-helpers';

/**
 * UI defect reproduced manually, documented in BUGS.md as BUG-05 (test case TC-24).
 *
 * The test asserts what a user is entitled to expect: one click on "Confirm"
 * places the order. The current build needs two, so the test is marked with
 * `test.fail()` and shows up as an expected failure in the report.
 */
test.describe('Known UI defects @known-defect', () => {
  test('BUG-05 one click on "Confirm" places the order', async ({ page, api, authed, product }) => {
    test.fail(
      true,
      'BUG-05: the first "Confirm" click only validates the payment, a second click is required to create the order',
    );

    await loginViaUi(page, authed.customer);
    await addProductToCart(page, product.id);
    await page.goto('/checkout');

    await page.getByTestId('proceed-1').click();
    await page.getByTestId('proceed-2').click();

    await fillBillingAddress(page, api);
    await page.getByTestId('proceed-3').click();
    await page.getByTestId('payment-method').selectOption('cash-on-delivery');

    // A single click must be enough to place the order.
    await page.getByTestId('finish').click();

    // Evidence for BUGS.md: exactly what the customer sees after pressing
    // "Confirm" once - a success message and no order.
    await page.waitForTimeout(2_000);
    await page.screenshot({
      path: 'reports/screenshots/BUG-05-after-first-click.png',
      fullPage: true,
    });

    await expect(
      page.locator('#order-confirmation'),
      'the order is created on the first "Confirm" click',
    ).toBeVisible({ timeout: 15_000 });
  });
});
