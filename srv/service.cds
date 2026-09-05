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

  @odata.draft.enabled
  entity Customers as projection on db.Customers {
    *,
    virtual null as numberOfOrders : Integer,
  };

  @readonly
  @cds.redirection.target: false
  entity CustomerCompanies as select from db.Customers {
    key company
  } where company is not null
  group by company;

  @odata.draft.enabled
  entity Products as projection on db.Products {
    *,
    virtual null as ordersThisMonth  : Integer,
    virtual null as revenue          : Decimal(11, 2),
    virtual null as averageQuantity  : Decimal(9, 2),
  };

  @readonly entity UnitCodes as projection on db.UnitCodes;
  
  @odata.draft.enabled
  entity Materials as projection on db.Materials {
    *,
    case status
      when 'AVAILABLE'   then 3
      when 'LOW_STOCK'   then 5
      when 'CRITICAL'    then 2
      when 'OUT_OF_STOCK' then 1
      else 0
    end as statusCriticality : Integer,
  };

  entity MaterialStocks as projection on db.MaterialStocks {
    *,
    quantityOnHand - reservedQuantity as available : Decimal(12, 3),

    case
      when quantityOnHand - reservedQuantity <= 0                 then 'OUT_OF_STOCK'
      when quantityOnHand - reservedQuantity <= criticalThreshold then 'CRITICAL'
      when quantityOnHand - reservedQuantity <= reorderThreshold  then 'LOW_STOCK'
      else 'AVAILABLE'
    end as stockStatus : db.MaterialStatus,

    case
      when quantityOnHand - reservedQuantity <= 0                 then 1
      when quantityOnHand - reservedQuantity <= criticalThreshold then 2
      when quantityOnHand - reservedQuantity <= reorderThreshold  then 5
      else 3
    end as stockCriticality : Integer,
  };

  @readonly entity MaterialStatusCodes as projection on db.MaterialStatusCodes;

  @odata.draft.enabled
  entity Warehouses as projection on db.Warehouses {
    *,
    virtual null as totalMaterials      : Integer,
    virtual null as lowStockCount       : Integer,
    virtual null as criticalCount       : Integer,
    virtual null as stockValue          : Decimal(12, 2),
    virtual null as lowStockCriticality : Integer,
    virtual null as criticalCriticality : Integer,
  };


  @Capabilities.InsertRestrictions.Insertable: false
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

      totalAmount - paidAmount as balanceDue : Decimal(11, 2),
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

  @Capabilities.InsertRestrictions.Insertable: false
  @Capabilities.DeleteRestrictions.Deletable: false
  entity Payments as projection on db.Payments {
      *,
      case status
        when 'COMPLETED' then 3
        when 'PENDING'   then 2
        when 'REFUNDED'  then 1
        else 0
      end as paymentTxCriticality : Integer,

      virtual null as customerName : String(120),
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