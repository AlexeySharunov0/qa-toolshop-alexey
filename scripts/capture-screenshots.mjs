#!/usr/bin/env node
/**
 * Captures the two UI screenshots referenced from BUGS.md.
 * Run after the local Toolshop instance is up and the catalogue cache is current.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
config({ path: join(root, '.env') });

const UI = process.env.UI_URL ?? 'http://localhost:4200';
const API = process.env.API_URL ?? 'http://localhost:8091';
const OUT = join(root, 'reports/screenshots');

async function call(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function register() {
  const email = `shot.${Date.now()}@example.com`;
  const password = 'Qa!Evidence9Zz';
  const customer = {
    first_name: 'Shot',
    last_name: 'Capture',
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
    email,
    password,
  };
  const reg = await call('POST', '/users/register', { body: customer });
  if (reg.status !== 201) throw new Error(`register ${reg.status} ${JSON.stringify(reg.body)}`);
  const login = await call('POST', '/users/login', { body: { email, password } });
  return { customer, token: login.body.access_token };
}

const lookup = await call('GET', '/postcode-lookup?country=NL&postcode=1011AB&house_number=12');
const pliers = (await call('GET', '/products?q=Long%20Nose%20Pliers')).body.data.find(
  (p) => p.name === 'Long Nose Pliers',
);
const list = (await call('GET', '/products?between=price,1,100&sort=price,asc')).body.data;
let inStock;
for (const candidate of list) {
  if (candidate.name === 'Washers' || candidate.name === 'Long Nose Pliers') continue;
  const detail = await call('GET', `/products/${candidate.id}`);
  if (detail.status === 200 && detail.body.in_stock !== false) {
    inStock = detail.body;
    break;
  }
}
if (!inStock) throw new Error('no in-stock product for BUG-05 screenshot');
const { customer } = await register();

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20_000);
const t = (id) => page.locator(`[data-test="${id}"]`);

await page.goto(`${UI}/product/${pliers.id}`);
await t('product-name').waitFor();
await page.screenshot({
  path: join(OUT, 'BUG-01-out-of-stock-product-page.png'),
  fullPage: true,
});

await page.goto(`${UI}/auth/login`);
await t('email').fill(customer.email);
await t('password').fill(customer.password);
await t('login-submit').click();
await t('nav-sign-out').waitFor({ state: 'attached' });

await page.goto(`${UI}/product/${inStock.id}`);
await t('product-name').waitFor();
await t('add-to-cart').click();
await t('cart-quantity').waitFor();

await page.goto(`${UI}/checkout`);
await t('proceed-1').click();
await t('proceed-2').click();
await t('country').selectOption('NL');
await t('postal_code').fill('');
await t('postal_code').fill('1011AB');
await t('house_number').fill('');
await t('house_number').fill('12');
await page.waitForFunction(
  (city) => document.querySelector('[data-test="city"]')?.value === city,
  lookup.body.city,
);
await t('proceed-3').click();
await t('payment-method').selectOption('cash-on-delivery');
await t('finish').click();
await t('payment-success-message').waitFor();
await page.screenshot({
  path: join(OUT, 'BUG-05-after-first-click.png'),
  fullPage: true,
});

await browser.close();
console.log('wrote', OUT);
