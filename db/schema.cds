namespace printflow.db;

using {
  cuid,
  managed
} from '@sap/cds/common';

// ---------------------------------------------------------------------------
// Enums / Types (Stage 1, pt. 8 / 0.34)
// ---------------------------------------------------------------------------

type Unit             : String enum {
  PIECE; SET; SQM; M;
}

type Urgency          : String enum {
  STANDARD; EXPRESS; URGENT;
}

type OrderStatus      : String enum {
  DRAFT; SUBMITTED; CONFIRMED; IN_PRODUCTION; READY; DELIVERED; CANCELLED;
}

type ProductionStatus : String enum {
  PLANNED; IN_PROGRESS; PAUSED; QUALITY_CHECK; REWORK; COMPLETED; CANCELLED;
}

type PaymentTxStatus  : String enum {
  PENDING; COMPLETED; REFUNDED;
}

type PaymentStatus    : String enum {
  UNPAID; PARTIALLY_PAID; PAID;
}

type DeliveryStatus   : String enum {
  NOT_SCHEDULED; SCHEDULED; IN_TRANSIT; DELIVERED; FAILED;
}

type PaymentMethod    : String enum {
  CARD; BANK_TRANSFER; CASH;
}

type MaterialStatus   : String enum {
  AVAILABLE; LOW_STOCK; CRITICAL; OUT_OF_STOCK;
}

// ---------------------------------------------------------------------------
// Master data (Stage 1, pt. 3–7)
// ---------------------------------------------------------------------------

entity Customers : cuid, managed {
  name    : String(120) not null;
  email   : String(120);
  phone   : String(30);
  company : String(120);

  orders  : Association to many SalesOrders
              on orders.customer = $self;
}

entity Products : cuid, managed {
  code        : String(20)  not null;
  name        : String(120) not null;
  description : String(1000);
  unit        : Unit;
  basePrice   : Decimal(9, 2);

  orderItems  : Association to many OrderItems
                  on orderItems.product = $self;
}

entity Materials : cuid, managed {
  code       : String(20)  not null;
  name       : String(120) not null;
  unit       : Unit;
  unitCost   : Decimal(9, 2);

  // calculated / aggregate field — persisted, recomputed by business logic (Stage 2)
  status     : MaterialStatus default 'AVAILABLE';

  stocks     : Association to many MaterialStocks
                 on stocks.material = $self;
}

entity Warehouses : cuid, managed {
  code     : String(10)  not null;
  name     : String(120) not null;
  location : String(200);

  stocks   : Association to many MaterialStocks
               on stocks.warehouse = $self;
}

entity MaterialStocks : cuid, managed {
  material          : Association to Materials  not null;
  warehouse         : Association to Warehouses  not null;
  quantityOnHand    : Decimal(12, 3) default 0;
  reservedQuantity  : Decimal(12, 3) default 0;
  reorderThreshold  : Decimal(12, 3) default 0;
  criticalThreshold : Decimal(12, 3) default 0;
}

// ---------------------------------------------------------------------------
// Sales order aggregate (Stage 1, pt. 3–7)
// root: SalesOrders, compositions: items / productionOrders / payments / deliveries
// ---------------------------------------------------------------------------

entity SalesOrders : cuid, managed {
  orderNo                : String(20) not null;
  customer               : Association to Customers not null;

  status                 : OrderStatus default 'DRAFT';
  urgencyLevel           : Urgency     default 'STANDARD';
  discountPercent        : Decimal(5, 2) default 0;
  requestedDeliveryDate  : Date;

  // calculated fields (Stage 2 business logic fills these in)
  totalAmount            : Decimal(11, 2) default 0;
  paidAmount             : Decimal(11, 2) default 0;
  paymentStatus          : PaymentStatus  default 'UNPAID';

  items                  : Composition of many OrderItems
                              on items.parent = $self;
  productionOrders       : Composition of many ProductionOrders
                              on productionOrders.parent = $self;
  payments               : Composition of many Payments
                              on payments.parent = $self;
  deliveries             : Composition of many Deliveries
                              on deliveries.parent = $self;
}

entity OrderItems : cuid, managed {
  parent           : Association to SalesOrders not null;
  product          : Association to Products    not null;
  quantity         : Integer default 1;
  unitPrice        : Decimal(9, 2);
  finishingOptions : String(500);

  // calculated field: quantity * unitPrice (Stage 2)
  lineTotal        : Decimal(11, 2) default 0;
}

entity ProductionOrders : cuid, managed {
  parent               : Association to SalesOrders not null;
  status               : ProductionStatus default 'PLANNED';
  plannedStart         : DateTime;
  plannedEnd           : DateTime;
  actualStart          : DateTime;
  actualEnd            : DateTime;

  // calculated field via calculateEstimatedCompletion() (Stage 2)
  estimatedCompletion  : DateTime;
}

entity Payments : cuid, managed {
  parent  : Association to SalesOrders not null;
  amount  : Decimal(11, 2) not null;
  method  : PaymentMethod;
  paidAt  : DateTime;
  status  : PaymentTxStatus default 'PENDING';
}

entity Deliveries : cuid, managed {
  parent          : Association to SalesOrders not null;
  status          : DeliveryStatus default 'NOT_SCHEDULED';
  address         : String(300);
  scheduledDate   : Date;
  deliveredAt     : DateTime;
  trackingNumber  : String(50);
}

@readonly
entity OrderStatusCodes {
  key code : OrderStatus;
      name : String(40);
}

@readonly
entity UrgencyCodes {
  key code : Urgency;
      name : String(40);
}

@readonly
entity PaymentStatusCodes {
  key code : PaymentStatus;
      name : String(40);
}

@readonly
entity ProductionStatusCodes {
  key code : ProductionStatus;
      name : String(40);
}

@readonly
entity PaymentMethodCodes {
  key code : PaymentMethod;
      name : String(40);
}

@readonly
entity PaymentTxStatusCodes {
  key code : PaymentTxStatus;
      name : String(40);
}

@readonly
entity DeliveryStatusCodes {
  key code : DeliveryStatus;
      name : String(40);
}

@readonly
entity UnitCodes {
  key code : Unit;
      name : String(40);
}

@readonly
entity MaterialStatusCodes {
  key code : MaterialStatus;
      name : String(40);
}