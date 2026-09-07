using {printflow.db as db} from '../db/schema';

type MaterialRequirement {
  materialCode : String;
  materialName : String;
  unit         : String;
  requiredQty  : Decimal(12,3);
  availableQty : Decimal(12,3);
  sufficient   : Boolean;
}

type OrderSummary {
  totalAmount     : Decimal(11,2);
  discountPercent : Decimal(5,2);
  paidAmount      : Decimal(11,2);
  balanceDue      : Decimal(11,2);
}

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
    case
      when status = 'AVAILABLE'    then 3
      when status = 'LOW_STOCK'    then 5
      when status = 'CRITICAL'     then 2
      when status = 'OUT_OF_STOCK' then 1
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
      case
        when status = 'READY'         then 3
        when status = 'DELIVERED'     then 3
        when status = 'IN_PRODUCTION' then 2
        when status = 'SUBMITTED'     then 2
        when status = 'CONFIRMED'     then 5
        when status = 'CANCELLED'     then 1
        else 0
      end as statusCriticality : Integer,

      case
        when urgencyLevel = 'URGENT'  then 1
        when urgencyLevel = 'EXPRESS' then 2
        else 0
      end as urgencyCriticality : Integer,

      case
        when paymentStatus = 'PAID'           then 3
        when paymentStatus = 'PARTIALLY_PAID' then 2
        when paymentStatus = 'UNPAID'         then 1
        else 0
      end as paymentCriticality : Integer,

      totalAmount - paidAmount as balanceDue : Decimal(11, 2),
  } actions {
    function checkMaterialAvailability() returns array of MaterialRequirement;
    function getOrderSummary()           returns OrderSummary;

    action submitOrder()     returns SalesOrders;
    action confirmOrder()    returns SalesOrders;
    action cancelOrder()     returns SalesOrders;
    action startProduction() returns SalesOrders;
    action markOrderReady()  returns SalesOrders;

    action registerPayment(amount: Decimal(11,2), method: db.PaymentMethod, paidAt: DateTime) returns Payments;
  };

  entity OrderItems as projection on db.OrderItems;

  entity ProductionOrders as projection on db.ProductionOrders {
      *,
      case
        when status = 'COMPLETED'     then 3
        when status = 'IN_PROGRESS'   then 5
        when status = 'QUALITY_CHECK' then 2
        when status = 'PAUSED'        then 1
        when status = 'REWORK'        then 1
        when status = 'CANCELLED'     then 1
        else 0
      end as productionCriticality : Integer
  } actions {
    action pauseProduction()    returns ProductionOrders;
    action completeProduction() returns ProductionOrders;
  };

  @Capabilities.InsertRestrictions.Insertable: false
  @Capabilities.DeleteRestrictions.Deletable: false
  entity Payments as projection on db.Payments {
      *,
      case
        when status = 'COMPLETED' then 3
        when status = 'PENDING'   then 2
        when status = 'REFUNDED'  then 1
        else 0
      end as paymentTxCriticality : Integer,

      virtual null as customerName : String(120),
  };

  @Capabilities.InsertRestrictions.Insertable: false
  @Capabilities.DeleteRestrictions.Deletable: false
  entity Deliveries as projection on db.Deliveries {
      *,
      virtual null as customerName : String(120),
      case
        when status = 'DELIVERED'  then 3
        when status = 'IN_TRANSIT' then 5
        when status = 'SCHEDULED'  then 2
        when status = 'FAILED'     then 1
        else 0
      end as deliveryCriticality : Integer
  };

  @readonly entity BillOfMaterials       as projection on db.BillOfMaterials;
  @readonly entity OrderStatusCodes      as projection on db.OrderStatusCodes;
  @readonly entity UrgencyCodes          as projection on db.UrgencyCodes;
  @readonly entity PaymentStatusCodes    as projection on db.PaymentStatusCodes;
  @readonly entity ProductionStatusCodes as projection on db.ProductionStatusCodes;
  @readonly entity PaymentMethodCodes    as projection on db.PaymentMethodCodes;
  @readonly entity PaymentTxStatusCodes  as projection on db.PaymentTxStatusCodes;
  @readonly entity DeliveryStatusCodes   as projection on db.DeliveryStatusCodes;
}