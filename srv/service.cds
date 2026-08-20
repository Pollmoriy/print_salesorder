using {printflow.db as db} from '../db/schema';

/**
 * SalesOrderService — Stage 1 skeleton.
 * Exposes domain entities as plain OData V4 CRUD projections.
 * No custom handlers, no actions/functions, no business logic yet
 * (that's Stage 2 / feature/business-logic).
 */
service SalesOrderService @(path: '/odata/v4/sales-order') {

  entity Customers         as projection on db.Customers;
  entity Products          as projection on db.Products;
  entity Materials         as projection on db.Materials;
  entity Warehouses        as projection on db.Warehouses;
  entity MaterialStocks    as projection on db.MaterialStocks;

  entity SalesOrders       as projection on db.SalesOrders;
  entity OrderItems        as projection on db.OrderItems;
  entity ProductionOrders  as projection on db.ProductionOrders;
  entity Payments          as projection on db.Payments;
  entity Deliveries        as projection on db.Deliveries;
}
