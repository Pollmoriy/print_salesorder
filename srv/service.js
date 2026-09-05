const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  this.after('READ', 'Customers', async (customers) => {
    const rows = Array.isArray(customers) ? customers : [customers];
    if (!rows.length) return;

    const counts = await SELECT
      .from('SalesOrderService.SalesOrders')
      .columns('customer_ID as customer_ID', 'count(*) as cnt')
      .groupBy('customer_ID')
      .where({ customer_ID: rows.map(r => r.ID) });

    const byCustomer = Object.fromEntries(counts.map(c => [c.customer_ID, c.cnt]));
    rows.forEach(r => { r.numberOfOrders = byCustomer[r.ID] || 0; });
  });

  this.after('READ', 'Products', async (products) => {
    const rows = Array.isArray(products) ? products : [products];
    if (!rows.length) return;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const items = await SELECT
      .from('SalesOrderService.OrderItems')
      .columns('product_ID', 'quantity', 'lineTotal', 'parent_ID')
      .where({ product_ID: rows.map(r => r.ID) });

    const parentIds = [...new Set(items.map(i => i.parent_ID))];
    const orders = parentIds.length
      ? await SELECT.from('SalesOrderService.SalesOrders').columns('ID', 'createdAt').where({ ID: parentIds })
      : [];
    const orderDateById = Object.fromEntries(orders.map(o => [o.ID, o.createdAt]));

    const statsByProduct = {};
    for (const item of items) {
      const stats = statsByProduct[item.product_ID] ||= { orderIdsThisMonth: new Set(), revenueThisMonth: 0, quantities: [] };
      stats.quantities.push(Number(item.quantity) || 0);
      const orderDate = orderDateById[item.parent_ID];
      if (orderDate && orderDate >= monthStart) {
        stats.orderIdsThisMonth.add(item.parent_ID);
        stats.revenueThisMonth += Number(item.lineTotal) || 0;
      }
    }

    rows.forEach(r => {
      const stats = statsByProduct[r.ID];
      r.ordersThisMonth = stats ? stats.orderIdsThisMonth.size : 0;
      r.revenue = stats ? Number(stats.revenueThisMonth.toFixed(2)) : 0;
      r.averageQuantity = stats && stats.quantities.length
        ? Number((stats.quantities.reduce((a, b) => a + b, 0) / stats.quantities.length).toFixed(2))
        : 0;
    });
  });

    this.after('READ', 'Warehouses', async (warehouses) => {
    const rows = Array.isArray(warehouses) ? warehouses : [warehouses];
    if (!rows.length) return;

    const stocks = await SELECT
      .from('SalesOrderService.MaterialStocks')
      .columns('warehouse_ID', 'material_ID', 'quantityOnHand', 'reservedQuantity', 'reorderThreshold', 'criticalThreshold')
      .where({ warehouse_ID: rows.map(r => r.ID) });

    const materialIds = [...new Set(stocks.map(s => s.material_ID))];
    const materials = materialIds.length
      ? await SELECT.from('SalesOrderService.Materials').columns('ID', 'unitCost').where({ ID: materialIds })
      : [];
    const unitCostById = Object.fromEntries(materials.map(m => [m.ID, Number(m.unitCost) || 0]));

    const statsByWarehouse = {};
    for (const s of stocks) {
      const stats = statsByWarehouse[s.warehouse_ID] ||= { total: 0, low: 0, critical: 0, value: 0 };
      const available = (Number(s.quantityOnHand) || 0) - (Number(s.reservedQuantity) || 0);
      const reorderThreshold = Number(s.reorderThreshold) || 0;
      const criticalThreshold = Number(s.criticalThreshold) || 0;

      stats.total += 1;
      if (available <= 0 || available <= criticalThreshold) {
        stats.critical += 1;
      } else if (available <= reorderThreshold) {
        stats.low += 1;
      }
      stats.value += available * (unitCostById[s.material_ID] || 0);
    }

    rows.forEach(r => {
      const stats = statsByWarehouse[r.ID];
      r.totalMaterials      = stats ? stats.total : 0;
      r.lowStockCount       = stats ? stats.low : 0;
      r.criticalCount       = stats ? stats.critical : 0;
      r.stockValue          = stats ? Number(stats.value.toFixed(2)) : 0;
      r.lowStockCriticality = stats && stats.low > 0 ? 2 : 3;
      r.criticalCriticality = stats && stats.critical > 0 ? 1 : 3;
    });
  });

    this.after('READ', 'Payments', async (payments) => {
    const rows = Array.isArray(payments) ? payments : [payments];
    if (!rows.length) return;

    const parentIds = [...new Set(rows.map(r => r.parent_ID).filter(Boolean))];
    if (!parentIds.length) return;

    const orders = await SELECT.from('SalesOrderService.SalesOrders')
      .columns('ID', 'customer_ID').where({ ID: parentIds });
    const customerIdByOrder = Object.fromEntries(orders.map(o => [o.ID, o.customer_ID]));

    const customerIds = [...new Set(Object.values(customerIdByOrder).filter(Boolean))];
    const customers = customerIds.length
      ? await SELECT.from('SalesOrderService.Customers').columns('ID', 'name').where({ ID: customerIds })
      : [];
    const nameByCustomer = Object.fromEntries(customers.map(c => [c.ID, c.name]));

    rows.forEach(r => {
      const customerId = customerIdByOrder[r.parent_ID];
      r.customerName = customerId ? (nameByCustomer[customerId] || null) : null;
    });
  });

    this.after('READ', 'Deliveries', async (deliveries) => {
    const rows = Array.isArray(deliveries) ? deliveries : [deliveries];
    if (!rows.length) return;

    const parentIds = [...new Set(rows.map(r => r.parent_ID).filter(Boolean))];
    if (!parentIds.length) return;

    const orders = await SELECT.from('SalesOrderService.SalesOrders')
      .columns('ID', 'customer_ID').where({ ID: parentIds });
    const customerIdByOrder = Object.fromEntries(orders.map(o => [o.ID, o.customer_ID]));

    const customerIds = [...new Set(Object.values(customerIdByOrder).filter(Boolean))];
    const customers = customerIds.length
      ? await SELECT.from('SalesOrderService.Customers').columns('ID', 'name').where({ ID: customerIds })
      : [];
    const nameByCustomer = Object.fromEntries(customers.map(c => [c.ID, c.name]));

    rows.forEach(r => {
      const customerId = customerIdByOrder[r.parent_ID];
      r.customerName = customerId ? (nameByCustomer[customerId] || null) : null;
    });
  });
});

