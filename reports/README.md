# reports - как читать отчёт

Здесь лежит результат **финального** прогона, соответствующий последнему коммиту.

| Что | Где |
|---|---|
| HTML-отчёт Playwright | `html/index.html` - открыть `npx playwright show-report reports/html` или просто открыть файл в браузере |
| Машинный результат прогона | `results.json` |
| Trace упавших тестов | `traces/*.zip` - открыть `npx playwright show-trace reports/traces/<файл>.zip` |
| Скриншоты | `screenshots/` |
| Ответы API на дефекты | `evidence/*.json` |

## Итог прогона

```
24 теста: 19 passed, 5 expected failures, 0 unexpected, 0 flaky
длительность: ~23 секунды (прогон 2026-11-03 22:09 CET, `results.json` startTime 21:09:15Z)
```

**5 «ожидаемых падений» - это не поломанные тесты, а дефекты продукта.**
Каждый такой тест помечен в коде `test.fail()` и проверяет поведение, которого
продукт сейчас не обеспечивает. Playwright считает ожидаемое падение успехом,
поэтому в `results.json` вы увидите `"expected": 24, "unexpected": 0` - это
нормальный итог, а не «всё зелёное». В HTML-отчёте такие тесты помечены ✘ и
имеют статус *expected*.

| Тест | Дефект | Что происходит на самом деле |
|---|---|---|
| `api/known-defects.spec.ts` › BUG-01 a product with zero stock cannot be ordered | BUG-01 | товар с остатком 0 добавляется в корзину (200) и заказывается (201) |
| `api/known-defects.spec.ts` › BUG-02 cart quantity is limited by available stock | BUG-02 | 26 шт. при остатке 25 принимаются, остаток уходит в минус |
| `api/known-defects.spec.ts` › BUG-03 an empty cart cannot be turned into an order | BUG-03 | пустая корзина - заказ на 0.00 (201) |
| `api/known-defects.spec.ts` › BUG-04 another customer's cart cannot be consumed | BUG-04 | чужой `cart_id` - заказ создаётся (201) |
| `ui/known-defects.spec.ts` › BUG-05 one click on "Confirm" places the order | BUG-05 | заказ создаётся только вторым нажатием Confirm |

Остальные 19 тестов проходят: это критический путь, корзина, каталог, доступ и
валидация.

## Что смотреть в trace

Trace - это запись действий браузера/запросов с таймлайном, DOM-снимками и
ответами сети. Для API-дефектов в нём видно точный запрос и код ответа, для
BUG-05 - что после первого клика `POST /invoices` не уходит, а после второго уходит.

## Соответствие отчёта коду

Отчёт снят с коммита, указанного в `README.md` в разделе «Проверяемая версия
приложения». Если менять код тестов, отчёт нужно перегенерировать:
`npx playwright test`.
