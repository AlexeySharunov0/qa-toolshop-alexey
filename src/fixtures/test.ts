import { test as base, expect } from '@playwright/test';
import { Customer, Product, ShopApi } from '../api/shop-api';
import { buildCustomer } from '../data/factories';
import './matchers';

export interface AuthedCustomer {
  customer: Customer;
  token: string;
  userId: string;
}

interface Fixtures {
  /** Isolated API context; disposed after the test, so tests never share cookies. */
  api: ShopApi;
  /** Fresh, never-reused customer payload. */
  customer: Customer;
  /** A customer that already exists in the database and holds a bearer token. */
  authed: AuthedCustomer;
  /** A product that exists, is a regular (non-rental) item and is in stock. */
  product: Product;
}

/**
 * Products the known-defect tests deliberately drive out of stock.
 * They are excluded from the shared `product` fixture so a defect test can
 * never destabilise an unrelated one.
 */
const RESERVED_FOR_DEFECT_TESTS = new Set(['Washers', 'Long Nose Pliers']);

export const test = base.extend<Fixtures>({
  api: async ({}, use) => {
    const api = await ShopApi.create();
    await use(api);
    await api.dispose();
  },

  customer: async ({}, use) => {
    await use(buildCustomer());
  },

  authed: async ({ api, customer }, use) => {
    const { token, userId } = await api.registerAndLogin(customer);
    await use({ customer, token, userId });
  },

  /**
   * Picks a product that is really available *right now*.
   *
   * The list endpoint answers from a 300 s cache (ProductService::CACHE_TTL),
   * so `in_stock` there can be stale; the detail endpoint is authoritative and
   * is what the product page uses to enable "Add to cart".
   */
  product: async ({ api }, use) => {
    const list = await api.products({ between: 'price,1,100', sort: 'price,asc' });

    for (const candidate of list) {
      if (RESERVED_FOR_DEFECT_TESTS.has(candidate.name)) continue;

      const detail = await api.product(candidate.id);
      if (detail.status === 200 && detail.body.in_stock !== false) {
        await use(detail.body);
        return;
      }
    }

    throw new Error('No in-stock product found in the seeded catalogue');
  },
});

export { expect };
