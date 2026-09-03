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

  entity SalesOrders       as projection on db.SalesOrders {
    *,
    case status
      when 'READY'         then 3
      when 'DELIVERED'     then 3
      when 'IN_PRODUCTION' then 2
      when 'SUBMITTED'     then 2
      when 'CANCELLED'     then 1
      else 0
    end as statusCriticality : Integer
  };
  entity OrderItems        as projection on db.OrderItems;
  entity ProductionOrders  as projection on db.ProductionOrders;
  entity Payments          as projection on db.Payments;
  entity Deliveries        as projection on db.Deliveries;
}
