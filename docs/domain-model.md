# PrintFlow — Domain Model (Stage 1, pts. 3–11)

Этот документ фиксирует модель до написания CDS: сущности, поля, ассоциации/композиции, enum'ы и статус-модель.
Бизнес-логика (actions/functions, side effects) сюда НЕ входит — это Stage 2+.

## 1. Сущности верхнего уровня

| Entity            | Тип                | Назначение                                   |
|--------------------|--------------------|-----------------------------------------------|
| Customers          | master data        | заказчики печати                              |
| Products           | master data        | каталог продукции (буклеты, визитки, баннеры…)|
| Materials          | master data        | сырьё/материалы (бумага, краска, плёнка…)     |
| Warehouses         | master data        | склады, на которых хранятся материалы         |
| MaterialStocks     | master data (assoc)| остаток конкретного материала на складе       |
| SalesOrders        | transactional, root | заказ клиента                                |
| OrderItems         | transactional, composition of SalesOrders | позиции заказа |
| ProductionOrders   | transactional, composition of SalesOrders | производственные задания по заказу |
| Payments           | transactional, composition of SalesOrders | платежи по заказу |
| Deliveries         | transactional, composition of SalesOrders | доставки по заказу |

## 2. Поля по сущностям

### Customers
- `cuid`, `managed`
- `name`: String(120)
- `email`: String(120)
- `phone`: String(30)
- `company`: String(120) (optional)
- association `orders` → many `SalesOrders` on `orders.customer = $self`

### Products
- `cuid`, `managed`
- `code`: String(20) — артикул
- `name`: String(120)
- `description`: String(1000)
- `unit`: enum `Unit` (PIECE, SET, SQM, M)
- `basePrice`: Decimal(9,2)

### Materials
- `cuid`, `managed`
- `code`: String(20)
- `name`: String(120)
- `unit`: enum `Unit`
- `unitCost`: Decimal(9,2)
- association `stocks` → many `MaterialStocks` on `stocks.material = $self`
- **calculated field** `status`: enum `MaterialStatus` — не хранится напрямую как обычное поле ввода, вычисляется из агрегата остатков (см. п. calculated fields ниже), но для Stage 1 фиксируется как persisted stored field, обновляемый бизнес-логикой на Stage 2 (порог AVAILABLE/LOW STOCK/CRITICAL/OUT OF STOCK задаётся на уровне Material, не глобально)

### Warehouses
- `cuid`, `managed`
- `code`: String(10)
- `name`: String(120)
- `location`: String(200)

### MaterialStocks (association entity Material ↔ Warehouse)
- `cuid`, `managed`
- association `material` → one `Materials`
- association `warehouse` → one `Warehouses`
- `quantityOnHand`: Decimal(12,3)
- `reservedQuantity`: Decimal(12,3)
- `reorderThreshold`: Decimal(12,3) — порог для LOW STOCK
- `criticalThreshold`: Decimal(12,3) — порог для CRITICAL

### SalesOrders (root entity)
- `cuid`, `managed`
- `orderNo`: String(20) — человекочитаемый номер
- association `customer` → one `Customers`
- composition `items` → many `OrderItems` (of SalesOrders.items)
- composition `productionOrders` → many `ProductionOrders`
- composition `payments` → many `Payments`
- composition `deliveries` → many `Deliveries`
- `status`: enum `OrderStatus`
- `urgencyLevel`: enum `Urgency` (STANDARD, EXPRESS, URGENT)
- `discountPercent`: Decimal(5,2)
- `requestedDeliveryDate`: Date
- **calculated field** `totalAmount`: Decimal(11,2) — Items + materials + finishing + urgency + delivery − discount (см. `calculateOrderTotal()` в Stage 2)
- **calculated field** `paidAmount` / `paymentStatus` — производные от суммы `payments` (см. п. `PaymentStatus` ниже)

### OrderItems
- `cuid`, `managed`
- association `parent` (composition parent, implicit `up_`)
- association `product` → one `Products`
- `quantity`: Integer
- `unitPrice`: Decimal(9,2)
- `finishingOptions`: String(500) (свободный список, уточним на Stage 2 — возможно вынести в отдельный enum/entity)
- **calculated field** `lineTotal`: Decimal(11,2) = quantity × unitPrice

### ProductionOrders
- `cuid`, `managed`
- association `parent` (composition parent → SalesOrders)
- `status`: enum `ProductionStatus`
- `plannedStart`: DateTime
- `plannedEnd`: DateTime
- `actualStart`: DateTime
- `actualEnd`: DateTime
- **calculated field** `estimatedCompletion`: DateTime — из `calculateEstimatedCompletion()` (product, quantity, production steps, workload) — Stage 2

### Payments
- `cuid`, `managed`
- association `parent` (composition parent → SalesOrders)
- `amount`: Decimal(11,2)
- `method`: enum `PaymentMethod` (CARD, BANK_TRANSFER, CASH)
- `paidAt`: DateTime
- `status`: enum `PaymentTxStatus` (PENDING, COMPLETED, REFUNDED)

### Deliveries
- `cuid`, `managed`
- association `parent` (composition parent → SalesOrders)
- `status`: enum `DeliveryStatus`
- `address`: String(300)
- `scheduledDate`: Date
- `deliveredAt`: DateTime
- `trackingNumber`: String(50)

## 3. Composition-дерево (до кода)

```
SalesOrders (root)
 ├── items:              *OrderItems           (composition)
 ├── productionOrders:   *ProductionOrders      (composition)
 ├── payments:           *Payments              (composition)
 └── deliveries:         *Deliveries            (composition)
```

Независимые сущности (не composition, а association/aggregation — живут своей жизнью вне заказа):

```
Customers  ──1:N (association)──▶ SalesOrders
Products   ──1:N (association)──▶ OrderItems
Materials  ──1:N (association)──▶ MaterialStocks ◀──N:1── Warehouses
```

## 4. Enums / Types

Используем enum только там, где значение реально фиксированное (п. 0.34):

- `Unit`: PIECE, SET, SQM, M
- `Urgency`: STANDARD, EXPRESS, URGENT
- `OrderStatus`: DRAFT, SUBMITTED, CONFIRMED, IN_PRODUCTION, READY, DELIVERED, CANCELLED
- `ProductionStatus`: PLANNED, IN_PROGRESS, PAUSED, QUALITY_CHECK, REWORK, COMPLETED, CANCELLED
- `PaymentTxStatus`: PENDING, COMPLETED, REFUNDED
- `PaymentStatus` (агрегированный, на уровне SalesOrders): UNPAID, PARTIALLY_PAID, PAID
- `DeliveryStatus`: NOT_SCHEDULED, SCHEDULED, IN_TRANSIT, DELIVERED, FAILED
- `MaterialStatus`: AVAILABLE, LOW_STOCK, CRITICAL, OUT_OF_STOCK

## 5. Status Model — разрешённые переходы

### OrderStatus
```
DRAFT → SUBMITTED → CONFIRMED → IN_PRODUCTION → READY → DELIVERED
                 ↘ CANCELLED (из DRAFT/SUBMITTED/CONFIRMED)
```

### ProductionStatus
```
PLANNED → IN_PROGRESS ⇄ PAUSED
IN_PROGRESS → QUALITY_CHECK → COMPLETED
QUALITY_CHECK → REWORK → IN_PROGRESS
любой (кроме COMPLETED) → CANCELLED
```

### PaymentStatus (агрегат SalesOrders, из суммы Payments)
```
UNPAID → PARTIALLY_PAID → PAID
```

### DeliveryStatus
```
NOT_SCHEDULED → SCHEDULED → IN_TRANSIT → DELIVERED
                          ↘ FAILED
```

### MaterialStatus (агрегат из MaterialStocks vs thresholds)
```
AVAILABLE (qty > reorderThreshold)
LOW_STOCK (criticalThreshold < qty ≤ reorderThreshold)
CRITICAL  (0 < qty ≤ criticalThreshold)
OUT_OF_STOCK (qty = 0)
```

Логика пересчёта переходов реализуется actions/handlers в Stage 2 — здесь фиксируем только допустимые состояния и правила перехода.

## 6. Calculated fields (не хранятся как обычный ввод, вычисляются логикой Stage 2)

- `SalesOrders.totalAmount` — `calculateOrderTotal()`
- `OrderItems.lineTotal` — quantity × unitPrice
- `ProductionOrders.estimatedCompletion` — `calculateEstimatedCompletion()`
- `SalesOrders.paymentStatus` — сумма `payments.amount` vs `totalAmount`
- `Materials.status` — агрегат `MaterialStocks` vs thresholds (`checkMaterialAvailability()`)

## 7. Mock data — план (сами данные создаются позже, не в Stage 1)

- Реалистичные Customers (имена компаний/частных клиентов, а не "Customer 1/2/3")
- Products — конкретные позиции печатной продукции (визитки, буклеты, баннеры, наклейки…)
- Materials — конкретные материалы (мелованная бумага 130г, эко-соль краска CMYK, ламинация глянец…)
- Заказы в разных статусах жизненного цикла, чтобы наглядно показать UI (Draft/Confirmed/In Production/Delivered)
