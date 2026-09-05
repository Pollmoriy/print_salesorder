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
});

