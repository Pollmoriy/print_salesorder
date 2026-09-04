using {printflow.db as db} from '../db/schema';

/**
 * SalesOrderService — Stage 1 skeleton.
 * Exposes domain entities as plain OData V4 CRUD projections.
 * No custom handlers, no actions/functions, no business logic yet
 * (that's Stage 2 / feature/business-logic).
 *
 * Security foundation (Stage 1, pt. 17): only the anonymous vs.
 * authenticated distinction is enforced here via XSUAA. Role-based
 * access (Sales Manager / Production Manager / Administrator) is
 * introduced later, once UI and services take shape.
 */
service SalesOrderService @(
  path    : '/odata/v4/sales-order',
  requires: 'authenticated-user'
) {

  entity Customers         as projection on db.Customers;
  entity Products          as projection on db.Products;
  entity Materials         as projection on db.Materials;
  entity Warehouses        as projection on db.Warehouses;
  entity MaterialStocks    as projection on db.MaterialStocks;


  @odata.draft.enabled
  entity SalesOrders as projection on db.SalesOrders {
      *,
      case status
        when 'READY'         then 3
        when 'DELIVERED'     then 3
        when 'IN_PRODUCTION' then 2
        when 'SUBMITTED'     then 2
        when 'CONFIRMED'     then 5
        when 'CANCELLED'     then 1
        else 0
      end as statusCriticality : Integer,

      case urgencyLevel
        when 'URGENT'  then 1
        when 'EXPRESS' then 2
        else 0
      end as urgencyCriticality : Integer,

      case paymentStatus
        when 'PAID'           then 3
        when 'PARTIALLY_PAID' then 2
        when 'UNPAID'         then 1
        else 0
      end as paymentCriticality : Integer,
  };

  entity OrderItems as projection on db.OrderItems;

  entity ProductionOrders as projection on db.ProductionOrders {
      *,
      case status
        when 'COMPLETED'     then 3
        when 'IN_PROGRESS'   then 5
        when 'QUALITY_CHECK' then 2
        when 'PAUSED'        then 1
        when 'REWORK'        then 1
        when 'CANCELLED'     then 1
        else 0
      end as productionCriticality : Integer
  };

  entity Payments as projection on db.Payments {
      *,
      case status
        when 'COMPLETED' then 3
        when 'PENDING'   then 2
        when 'REFUNDED'  then 1
        else 0
      end as paymentTxCriticality : Integer
  };

  entity Deliveries as projection on db.Deliveries {
      *,
      case status
        when 'DELIVERED'  then 3
        when 'IN_TRANSIT' then 5
        when 'SCHEDULED'  then 2
        when 'FAILED'     then 1
        else 0
      end as deliveryCriticality : Integer
  };

  @readonly entity OrderStatusCodes      as projection on db.OrderStatusCodes;
  @readonly entity UrgencyCodes          as projection on db.UrgencyCodes;
  @readonly entity PaymentStatusCodes    as projection on db.PaymentStatusCodes;
  @readonly entity ProductionStatusCodes as projection on db.ProductionStatusCodes;
  @readonly entity PaymentMethodCodes    as projection on db.PaymentMethodCodes;
  @readonly entity PaymentTxStatusCodes  as projection on db.PaymentTxStatusCodes;
  @readonly entity DeliveryStatusCodes   as projection on db.DeliveryStatusCodes;
}