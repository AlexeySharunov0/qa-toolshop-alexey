import { Page, expect } from '@playwright/test';
import { Customer, ShopApi } from '../api/shop-api';

/** Signs in through the real login form (no cookie injection, no API shortcut). */
export async function loginViaUi(page: Page, customer: Customer): Promise<void> {
  await page.goto('/auth/login');
  await page.getByTestId('email').fill(customer.email);
  await page.getByTestId('password').fill(customer.password);
  await page.getByTestId('login-submit').click();

  // "Sign out" only exists in the DOM once a session exists; it lives in a
  // collapsed dropdown, so it is attached rather than visible.
  await expect(page.getByTestId('nav-sign-out'), 'login succeeded').toBeAttached();
  await expect(page, 'login navigated away from the form').not.toHaveURL(/\/auth\/login/);
}

/**
 * Opens a product page and adds one unit to the cart.
 *
 * The wait conditions matter: the button exists in the DOM before the product
 * payload is rendered, and a click dispatched in that window is a silent no-op
 * (no POST /carts at all). Waiting for the title and an enabled button, then
 * asserting the cart counter, makes the step verify its own result.
 */
export async function addProductToCart(page: Page, productId: string): Promise<void> {
  await page.goto(`/product/${productId}`);

  await expect(page.getByTestId('product-name'), 'product page rendered').toBeVisible();
  const addButton = page.getByTestId('add-to-cart');
  await expect(addButton, '"Add to cart" is enabled for an in-stock product').toBeEnabled();

  await addButton.click();

  await expect(page.getByTestId('cart-quantity'), 'cart counter shows the added item').toBeVisible();
}

/**
 * Fills the billing-address step.
 *
 * The step is pre-filled from the customer profile, and the postcode lookup
 * only runs when the postcode or house number actually changes. So the helper
 * clears the two fields first, types the values, and then waits until the
 * locality matches what the API says for that postcode - which is both the
 * real user flow and a check that the lookup integration works.
 */
export async function fillBillingAddress(
  page: Page,
  api: ShopApi,
  { country = 'NL', postcode = '1011AB', houseNumber = '12' } = {},
): Promise<void> {
  const expected = await api.postcodeLookup(country, postcode, houseNumber);
  expect(expected.status, 'postcode lookup answers').toBe(200);

  await page.getByTestId('country').selectOption(country);

  // Clear first: an unchanged value fires no change event and no lookup.
  await page.getByTestId('postal_code').fill('');
  await page.getByTestId('postal_code').fill(postcode);
  await page.getByTestId('house_number').fill('');
  await page.getByTestId('house_number').fill(houseNumber);

  await expect
    .poll(
      async () => ({
        city: await page.getByTestId('city').inputValue(),
        state: await page.getByTestId('state').inputValue(),
      }),
      { message: 'street/city/state are filled by the postcode lookup', timeout: 15_000 },
    )
    .toEqual({ city: expected.body.city, state: expected.body.state });

  await expect(page.getByTestId('street')).not.toHaveValue('');
}

/** Parses "$12.34" (or "- $12.34") into 12.34. */
export function parseMoney(text: string): number {
  const match = text.replace(/\s/g, '').match(/-?\$?(-?[\d.]+)/);
  if (!match) throw new Error(`Cannot parse money from "${text}"`);
  return Number(match[1]);
}
