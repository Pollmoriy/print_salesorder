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

  // --- Input validation (Stage 3) -------------------------------------------

  this.before(['CREATE', 'UPDATE'], 'OrderItems', (req) => {
    const { quantity, unitPrice, product_ID } = req.data;
    if (!product_ID) req.error(400, 'Product is required');
    if (quantity != null && Number(quantity) <= 0) req.error(400, 'Quantity must be greater than zero');
    if (unitPrice != null && Number(unitPrice) < 0) req.error(400, 'Unit price cannot be negative');
  });

  this.before(['CREATE', 'UPDATE'], 'Payments', (req) => {
    const { amount, method } = req.data;
    if (amount != null && Number(amount) <= 0) req.error(400, 'Payment amount must be greater than zero');
    if (req.event === 'CREATE' && !method) req.error(400, 'Payment method is required');
  });

  this.before(['CREATE', 'UPDATE'], 'Deliveries', (req) => {
    const { address, scheduledDate } = req.data;
    if (req.event === 'CREATE' && !address) req.error(400, 'Delivery address is required');
    if (scheduledDate && isNaN(Date.parse(scheduledDate))) req.error(400, 'Invalid scheduled date');
  });

  this.before(['CREATE', 'UPDATE'], 'SalesOrders', (req) => {
    const { discountPercent, requestedDeliveryDate, customer_ID } = req.data;
    if (req.event === 'CREATE' && !customer_ID) req.error(400, 'Customer is required');
    if (discountPercent != null && (Number(discountPercent) < 0 || Number(discountPercent) > 100)) {
      req.error(400, 'Discount must be between 0 and 100');
    }
    if (requestedDeliveryDate && isNaN(Date.parse(requestedDeliveryDate))) {
      req.error(400, 'Invalid requested delivery date');
    }
  });

  this.before(['CREATE', 'UPDATE'], 'ProductionOrders', (req) => {
    const { plannedStart, plannedEnd, actualStart, actualEnd } = req.data;
    if (plannedStart && plannedEnd && new Date(plannedEnd) < new Date(plannedStart)) {
      req.error(400, 'Planned end cannot be before planned start');
    }
    if (actualStart && actualEnd && new Date(actualEnd) < new Date(actualStart)) {
      req.error(400, 'Actual end cannot be before actual start');
    }
  });

  this.before(['CREATE', 'UPDATE'], 'Materials', (req) => {
    const { unitCost } = req.data;
    if (unitCost != null && Number(unitCost) < 0) req.error(400, 'Unit cost cannot be negative');
  });

  this.before(['CREATE', 'UPDATE'], 'MaterialStocks', (req) => {
    const { quantityOnHand, reservedQuantity, reorderThreshold, criticalThreshold } = req.data;
    if (quantityOnHand != null && Number(quantityOnHand) < 0) req.error(400, 'Quantity on hand cannot be negative');
    if (reservedQuantity != null && Number(reservedQuantity) < 0) req.error(400, 'Reserved quantity cannot be negative');
    if (reorderThreshold != null && Number(reorderThreshold) < 0) req.error(400, 'Reorder threshold cannot be negative');
    if (criticalThreshold != null && Number(criticalThreshold) < 0) req.error(400, 'Critical threshold cannot be negative');
  });

  this.before(['CREATE', 'UPDATE'], 'Products', (req) => {
    const { basePrice, code } = req.data;
    if (req.event === 'CREATE' && !code) req.error(400, 'Product code is required');
    if (basePrice != null && Number(basePrice) < 0) req.error(400, 'Base price cannot be negative');
  });

  this.before(['CREATE', 'UPDATE'], 'Customers', (req) => {
    const { name, email } = req.data;
    if (req.event === 'CREATE' && !name) req.error(400, 'Customer name is required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) req.error(400, 'Invalid email format');
  });

    this.on('checkMaterialAvailability', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];

    const items = await SELECT
      .from('SalesOrderService.OrderItems')
      .columns('product_ID', 'quantity')
      .where({ parent_ID: orderId });

    if (!items.length) return [];

    const productIds = [...new Set(items.map(i => i.product_ID))];
    const products = await SELECT
      .from('SalesOrderService.Products')
      .columns('ID', 'code')
      .where({ ID: productIds });
    const codeByProductId = Object.fromEntries(products.map(p => [p.ID, p.code]));

    const productCodes = [...new Set(products.map(p => p.code))];
    const bom = productCodes.length
      ? await SELECT.from('SalesOrderService.BillOfMaterials')
          .columns('productCode', 'materialCode', 'quantityPerUnit')
          .where({ productCode: productCodes })
      : [];

    const requiredByMaterialCode = {};
    for (const item of items) {
      const productCode = codeByProductId[item.product_ID];
      const bomRows = bom.filter(b => b.productCode === productCode);
      for (const b of bomRows) {
        const need = Number(item.quantity) * Number(b.quantityPerUnit);
        requiredByMaterialCode[b.materialCode] = (requiredByMaterialCode[b.materialCode] || 0) + need;
      }
    }

    const materialCodes = Object.keys(requiredByMaterialCode);
    if (!materialCodes.length) return [];

    const materials = await SELECT
      .from('SalesOrderService.Materials')
      .columns('ID', 'code', 'name', 'unit')
      .where({ code: materialCodes });

    const materialIds = materials.map(m => m.ID);
    const stocks = materialIds.length
      ? await SELECT.from('SalesOrderService.MaterialStocks')
          .columns('material_ID', 'quantityOnHand', 'reservedQuantity')
          .where({ material_ID: materialIds })
      : [];

    const availableByMaterialId = {};
    for (const s of stocks) {
      const avail = (Number(s.quantityOnHand) || 0) - (Number(s.reservedQuantity) || 0);
      availableByMaterialId[s.material_ID] = (availableByMaterialId[s.material_ID] || 0) + avail;
    }

    return materials.map(m => {
      const requiredQty = Number(requiredByMaterialCode[m.code].toFixed(3));
      const availableQty = Number((availableByMaterialId[m.ID] || 0).toFixed(3));
      return {
        materialCode: m.code,
        materialName: m.name,
        unit: m.unit,
        requiredQty,
        availableQty,
        sufficient: availableQty >= requiredQty
      };
    });
  });

  this.on('getOrderSummary', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const [order] = await SELECT.from('SalesOrderService.SalesOrders')
      .columns('totalAmount', 'discountPercent', 'paidAmount', 'balanceDue')
      .where({ ID: orderId });
    return order;
  });
});

