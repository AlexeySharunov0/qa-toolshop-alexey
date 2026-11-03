import { randomUUID } from 'node:crypto';
import { Customer, InvoicePayload, PaymentMethod, ShopApi } from '../api/shop-api';

/**
 * Test data is generated per test, never shared.
 *
 * Reason (T3 in TEST_PLAN.md): an account is locked after
 * `MAX_LOGIN_ATTEMPTS = 3` failed logins, so a single shared user turns one
 * negative authentication check into a cascade of unrelated failures.
 */
export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);

  return {
    first_name: 'QA',
    last_name: 'Automation',
    // Consistent with what the local postcode lookup returns for NL/1011AB,
    // so the address step is pre-filled with a valid address instead of one
    // that the API will reject as "city does not belong to the country".
    address: {
      street: 'Autarboulevard',
      house_number: '12',
      city: 'Stroe',
      state: 'Groningen',
      country: 'NL',
      postal_code: '1011AB',
    },
    phone: '0612345678',
    dob: '1990-01-01',
    email: `qa.${suffix}@example.com`,
    // Password policy: min 8, mixed case, digits, symbols.
    password: `Qa!${suffix}Zz9`,
    ...overrides,
  };
}

export interface BillingAddress {
  billing_street: string;
  billing_city: string;
  billing_state: string;
  billing_country: string;
  billing_postal_code: string;
}

/**
 * Billing address for an order.
 *
 * `AddressMatchesCountry` on the API compares city/state against the postcode
 * lookup result, so the payload is built from the lookup instead of being
 * invented: otherwise a validation failure would be mistaken for a product bug.
 */
export async function billingFromLookup(
  api: ShopApi,
  { country = 'NL', postcode = '1011AB', houseNumber = '12' } = {},
): Promise<BillingAddress> {
  const lookup = await api.postcodeLookup(country, postcode, houseNumber);
  if (lookup.status !== 200) {
    throw new Error(`postcode-lookup failed: HTTP ${lookup.status} ${JSON.stringify(lookup.body)}`);
  }

  return {
    billing_street: lookup.body.street || 'Zoey Shore',
    billing_city: lookup.body.city,
    billing_state: lookup.body.state,
    billing_country: country,
    billing_postal_code: postcode,
  };
}

export function buildInvoicePayload(
  cartId: string,
  billing: BillingAddress,
  paymentMethod: PaymentMethod = 'cash-on-delivery',
): InvoicePayload {
  return {
    ...billing,
    payment_method: paymentMethod,
    payment_details: {},
    cart_id: cartId,
  };
}
