# PrintFlow — Деплой на BTP (Stage 1, пп. 14 и 19)

Всё, что описано ниже, требует твоего логина в конкретный BTP subaccount /
Cloud Foundry space — у ассистента нет доступа к твоим кредам и к сети BTP
из песочницы, поэтому этот чеклист выполняется вручную (в BAS или локальном
терминале с `cf` CLI), так же как деплоился CRM.

Локально уже проверено и лежит в репозитории:
- `mta.yaml` — валиден (`mbt validate` проходит)
- `mbt build` — собирает MTAR (`mta_archives/print-salesorder_0.1.0.mtar`)
  без ошибок: db-deployer, srv (Node.js), approuter, orders (Fiori Elements
  UI5), app-deployer — все 5 модулей строятся чисто
- `cds build --production` генерирует `.hdbtable` / `.hdbview` для всех
  10 сущностей домена — это то, что задеплоится в HDI container

## Шаг 0 — предварительно

```bash
cf login   # выбрать нужный API endpoint / org / space
```

Если `cf` или `mbt` не установлены:
```bash
npm install -g mbt
```
(`cf` CLI ставится отдельно, в BAS уже предустановлен)

## П.14 — HANA Cloud + HDI container

Если HANA Cloud instance ещё не создан в этом subaccount (в BTP Cockpit,
не через cf CLI):
1. BTP Cockpit → Instances and Subscriptions → Create → HANA Cloud
2. Дождаться, пока instance перейдёт в статус `RUNNING` (может занять
   10–15 минут)

Дальше HDI container создаётся автоматически через `mta.yaml` (ресурс
`print-salesorder-db`, тип `com.sap.xs.hdi-container`, `service-plan: hdi-shared`) —
отдельно руками создавать не нужно, cf deploy сам его закажет и привяжет.

Быстрая проверка перед полным деплоем (изолированно, без остальных модулей):
```bash
cd print_salesorder
npx cds build --production
cd gen/db
npm install
npx hdi-deploy --user-cf-service <твой-hana-hdi-service-name>
```
(Если ты предпочитаешь через полный `cf deploy` из mta.yaml — см. Шаг ниже,
это надёжнее и ближе к тому, как задеплоен CRM.)

После деплоя — проверка таблиц:
- BTP Cockpit → HANA Cloud instance → Database Explorer
- Ищи схему с именем HDI container (обычно `<ID>` вида
  `print-salesorder-db-<hash>`)
- Должно быть 11 таблиц: 10 доменных (Customers, Products, Materials,
  Warehouses, MaterialStocks, SalesOrders, OrderItems, ProductionOrders,
  Payments, Deliveries) + `cds_outbox_Messages`

Бизнес-логика на этом шаге не нужна — цель просто
**"CAP model successfully exists in HANA Cloud"**.

## П.19 — первый полный деплой (XSUAA + HANA + HDI + Destination + HTML5 + srv + UI)

```bash
cd print_salesorder
npm install                       # синхронизировать package-lock.json
npx cds build --production
mbt build                         # соберёт mta_archives/print-salesorder_0.1.0.mtar
cf deploy mta_archives/print-salesorder_0.1.0.mtar
```

`cf deploy` закажет и привяжет все ресурсы из `mta.yaml` автоматически:
- `print-salesorder-auth` (XSUAA, plan `application`, конфиг из
  `xs-security.json` — сейчас там пустые scopes/roles, это ожидаемо на
  этом этапе)
- `print-salesorder-db` (HDI container)
- `print-salesorder-destination` (Destination service, plan `lite`)
- `print-salesorder-html5-repo-host` / `-runtime` (HTML5 App Repository)

И задеплоит 3 приложения (модули):
- `print-salesorder-srv` — CAP-сервис
- `print-salesorder` — approuter (входная точка)
- `print-salesorder-app-deployer` — заливает `orders.zip` в HTML5 repo

Деплой может занять 5–15 минут. Смотри прогресс в выводе `cf deploy` —
он покажет URL approuter'а в конце.

## Проверка после деплоя

1. **Сервис/OData** — открой `<srv-url>/odata/v4/sales-order/Products` —
   должно быть `401` без токена (XSUAA работает) — это ожидаемо (мы
   защитили сервис `authenticated-user`, п. 17)
2. **UI через approuter** — открой `<approuter-url>/orders/webapp/index.html`
   (approuter потребует SSO-логин через XSUAA — залогинься под своим
   BTP-пользователем)
3. Если открылось и Orders/Products видно (пусть и пустые) — это и есть
   критерий п. 19: минимальный PrintFlow существует и доступен через
   BTP: XSUAA + HANA Cloud + HDI + Destination + HTML5 App Repo +
   App Router + CAP service + UI.

## Известные мелочи, на которые не стоит тратить время сейчас

- `xs-security.json` сейчас `{ scopes: [], attributes: [], role-templates: [] }`
  — это нормально для Stage 1 (роли Sales/Production Manager/Administrator
  добавляются позже)
- Предупреждение UI5 build про `fallbackLocale 'en'` — не блокирует сборку,
  поправим при добавлении реальной локализации
- `npm audit` показывает несколько уязвимостей в транзитивных
  зависимостях approuter/UI5 tooling — стандартно для CAP-скелетов на
  этой стадии, не блокер
