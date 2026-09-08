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

  // =========================================================================
  // Stage 4 — Business Logic
  // =========================================================================

  const { SalesOrders, OrderItems, ProductionOrders, Payments,
          Materials, MaterialStocks, MaterialReservations } = this.entities;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // [ASSUMPTION] упрощённые тарифы — на учебном проекте не считаем реальную
  // логистику/типографские надбавки, только показываем, что backend считает
  // totalAmount сам, а не доверяет UI.
  const URGENCY_SURCHARGE_RATE = { STANDARD: 0, EXPRESS: 0.08, URGENT: 0.15 };
  const DELIVERY_FLAT_COST = 10;

  async function recalcOrderTotals(tx, orderId) {
    const items = await tx.run(SELECT.from(OrderItems).where({ parent_ID: orderId }));

    let subtotal = 0;
    for (const item of items) {
      const lineTotal = Number((Number(item.quantity) * Number(item.unitPrice || 0)).toFixed(2));
      subtotal += lineTotal;
      await tx.run(UPDATE(OrderItems).set({ lineTotal }).where({ ID: item.ID }));
    }

    const [order] = await tx.run(
      SELECT.from(SalesOrders).columns('urgencyLevel', 'discountPercent', 'paidAmount').where({ ID: orderId })
    );

    const urgencySurcharge = Number((subtotal * (URGENCY_SURCHARGE_RATE[order.urgencyLevel] || 0)).toFixed(2));
    const deliveryCost = subtotal > 0 ? DELIVERY_FLAT_COST : 0;
    const discount = Number((subtotal * (Number(order.discountPercent) || 0) / 100).toFixed(2));
    const totalAmount = Math.max(0, Number((subtotal + urgencySurcharge + deliveryCost - discount).toFixed(2)));

    const paidAmount = Number(order.paidAmount) || 0;
    const paymentStatus = totalAmount > 0 && paidAmount >= totalAmount ? 'PAID'
                          : paidAmount > 0 ? 'PARTIALLY_PAID'
                          : 'UNPAID';

    await tx.run(UPDATE(SalesOrders).set({ totalAmount, paymentStatus }).where({ ID: orderId }));
    return { subtotal, urgencySurcharge, deliveryCost, discount, totalAmount, paidAmount };
  }

  // Возвращает [{ materialId, materialCode, requiredQty, warehouseId, availableQty }]
  // или бросает бизнес-ошибку, если хотя бы одного материала не хватает.
  async function resolveMaterialsForOrder(tx, orderId) {
    const items = await tx.run(SELECT.from(OrderItems).columns('product_ID', 'quantity').where({ parent_ID: orderId }));
    if (!items.length) return [];

    const productIds = [...new Set(items.map(i => i.product_ID))];
    const products = await tx.run(SELECT.from('SalesOrderService.Products').columns('ID', 'code').where({ ID: productIds }));
    const codeByProductId = Object.fromEntries(products.map(p => [p.ID, p.code]));

    const productCodes = [...new Set(products.map(p => p.code))];
    const bom = productCodes.length
      ? await tx.run(SELECT.from('SalesOrderService.BillOfMaterials')
          .columns('productCode', 'materialCode', 'quantityPerUnit').where({ productCode: productCodes }))
      : [];

    const requiredByMaterialCode = {};
    for (const item of items) {
      const productCode = codeByProductId[item.product_ID];
      for (const b of bom.filter(x => x.productCode === productCode)) {
        const need = Number(item.quantity) * Number(b.quantityPerUnit);
        requiredByMaterialCode[b.materialCode] = (requiredByMaterialCode[b.materialCode] || 0) + need;
      }
    }

    const materialCodes = Object.keys(requiredByMaterialCode);
    if (!materialCodes.length) return [];

    const materials = await tx.run(SELECT.from(Materials).columns('ID', 'code').where({ code: materialCodes }));
    const materialIdByCode = Object.fromEntries(materials.map(m => [m.code, m.ID]));

    const stocks = await tx.run(SELECT.from(MaterialStocks)
      .columns('ID', 'material_ID', 'warehouse_ID', 'quantityOnHand', 'reservedQuantity')
      .where({ material_ID: materials.map(m => m.ID) }));

    const resolved = [];
    for (const code of materialCodes) {
      const requiredQty = Number(requiredByMaterialCode[code].toFixed(3));
      const materialId = materialIdByCode[code];
      const candidateStocks = stocks.filter(s => s.material_ID === materialId)
        .map(s => ({ ...s, available: Number(s.quantityOnHand) - Number(s.reservedQuantity) }))
        .sort((a, b) => b.available - a.available);

      const best = candidateStocks[0];
      if (!best || best.available < requiredQty) {
        const err = new Error(`Not enough material "${code}": required ${requiredQty}, available ${best ? best.available : 0}`);
        err.code = 400;
        throw err;
      }
      resolved.push({ materialId, materialCode: code, requiredQty, stockId: best.ID, warehouseId: best.warehouse_ID });
    }
    return resolved;
  }

  async function reserveMaterialsForOrder(tx, orderId) {
    const resolved = await resolveMaterialsForOrder(tx, orderId); // бросит ошибку, если чего-то не хватает
    for (const r of resolved) {
      await tx.run(
        UPDATE(MaterialStocks).set('reservedQuantity += ', r.requiredQty).where({ ID: r.stockId })
      );
      await tx.run(INSERT.into(MaterialReservations).entries({
        order_ID: orderId, material_ID: r.materialId, warehouse_ID: r.warehouseId,
        quantity: r.requiredQty, status: 'ACTIVE',
      }));
      await refreshMaterialStatus(tx, r.materialId);
    }
  }

  async function releaseReservationsForOrder(tx, orderId) {
    const reservations = await tx.run(SELECT.from(MaterialReservations).where({ order_ID: orderId, status: 'ACTIVE' }));
    for (const res of reservations) {
      const [stock] = await tx.run(SELECT.from(MaterialStocks)
        .columns('ID').where({ material_ID: res.material_ID, warehouse_ID: res.warehouse_ID }));
      if (stock) {
        await tx.run(UPDATE(MaterialStocks).set('reservedQuantity -= ', res.quantity).where({ ID: stock.ID }));
      }
      await tx.run(UPDATE(MaterialReservations).set({ status: 'RELEASED' }).where({ ID: res.ID }));
      await refreshMaterialStatus(tx, res.material_ID);
    }
  }

  async function consumeReservationsForOrder(tx, orderId) {
    const reservations = await tx.run(SELECT.from(MaterialReservations).where({ order_ID: orderId, status: 'ACTIVE' }));
    for (const res of reservations) {
      const [stock] = await tx.run(SELECT.from(MaterialStocks)
        .columns('ID').where({ material_ID: res.material_ID, warehouse_ID: res.warehouse_ID }));
      if (stock) {
        await tx.run(UPDATE(MaterialStocks)
          .set('quantityOnHand -= ', res.quantity)
          .set('reservedQuantity -= ', res.quantity)
          .where({ ID: stock.ID }));
      }
      await tx.run(UPDATE(MaterialReservations).set({ status: 'CONSUMED' }).where({ ID: res.ID }));
      await refreshMaterialStatus(tx, res.material_ID);
    }
  }

  async function refreshMaterialStatus(tx, materialId) {
    const stocks = await tx.run(SELECT.from(MaterialStocks)
      .columns('quantityOnHand', 'reservedQuantity', 'reorderThreshold', 'criticalThreshold')
      .where({ material_ID: materialId }));
    const totalAvailable = stocks.reduce((s, r) => s + (Number(r.quantityOnHand) - Number(r.reservedQuantity)), 0);
    const worstCritical = Math.min(...stocks.map(s => Number(s.criticalThreshold) || 0));
    const worstReorder = Math.min(...stocks.map(s => Number(s.reorderThreshold) || 0));

    let status = 'AVAILABLE';
    if (totalAvailable <= 0) status = 'OUT_OF_STOCK';
    else if (totalAvailable <= worstCritical) status = 'CRITICAL';
    else if (totalAvailable <= worstReorder) status = 'LOW_STOCK';

    await tx.run(UPDATE(Materials).set({ status }).where({ ID: materialId }));
  }

  function businessError(req, status, message) {
    req.error(status, message);
    throw new Error(message); // прерываем handler, транзакция откатится
  }

  // -------------------------------------------------------------------------
  // 4.6 SubmitOrder
  // -------------------------------------------------------------------------

  this.on('submitOrder', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'DRAFT') return req.error(400, `Order cannot be submitted from status ${order.status}`);
    if (!order.customer_ID) return req.error(400, 'Customer is required');

    const items = await tx.run(SELECT.from(OrderItems).where({ parent_ID: orderId }));
    if (!items.length) return req.error(400, 'Order must contain at least one item');
    for (const it of items) {
      if (!it.product_ID) return req.error(400, 'Every item must reference a product');
      if (Number(it.quantity) <= 0) return req.error(400, 'Quantity must be greater than zero');
    }

    await recalcOrderTotals(tx, orderId);
    await tx.run(UPDATE(SalesOrders).set({ status: 'SUBMITTED' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  // -------------------------------------------------------------------------
  // 4.7 ConfirmOrder — здесь же материалы резервируются
  // -------------------------------------------------------------------------

  this.on('confirmOrder', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'SUBMITTED') return req.error(400, `Order cannot be confirmed from status ${order.status}`);

    try {
      await reserveMaterialsForOrder(tx, orderId);
    } catch (e) {
      return req.error(e.code || 400, e.message);
    }

    await tx.run(UPDATE(SalesOrders).set({ status: 'CONFIRMED' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  // -------------------------------------------------------------------------
  // 4.20 CancelOrder
  // -------------------------------------------------------------------------

  const CANCELLABLE_FROM = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'IN_PRODUCTION', 'READY'];

  this.on('cancelOrder', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (!CANCELLABLE_FROM.includes(order.status)) {
      return req.error(400, `Order cannot be cancelled from status ${order.status}`);
    }

    await releaseReservationsForOrder(tx, orderId);

    await tx.run(UPDATE(ProductionOrders)
      .set({ status: 'CANCELLED' })
      .where({ parent_ID: orderId, status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED', 'QUALITY_CHECK', 'REWORK'] } }));

    await tx.run(UPDATE(SalesOrders).set({ status: 'CANCELLED' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  // -------------------------------------------------------------------------
  // 4.13 StartProduction
  // -------------------------------------------------------------------------

  this.on('startProduction', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'CONFIRMED') return req.error(400, `Production cannot be started for order in status ${order.status}`);

    // На случай если резервы почему-то ещё не созданы (защитный код)
    const activeReservations = await tx.run(SELECT.from(MaterialReservations).where({ order_ID: orderId, status: 'ACTIVE' }));
    if (!activeReservations.length) {
      try { await reserveMaterialsForOrder(tx, orderId); }
      catch (e) { return req.error(e.code || 400, e.message); }
    }

    // [ASSUMPTION] упрощённая оценка срока — без учёта текущей загрузки производства
    const daysByUrgency = { STANDARD: 5, EXPRESS: 3, URGENT: 1 };
    const days = daysByUrgency[order.urgencyLevel] || 5;
    const now = new Date();
    const estimatedCompletion = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await tx.run(INSERT.into(ProductionOrders).entries({
      parent_ID: orderId,
      status: 'IN_PROGRESS',
      plannedStart: now,
      actualStart: now,
      estimatedCompletion,
    }));

    await tx.run(UPDATE(SalesOrders).set({ status: 'IN_PRODUCTION' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  // -------------------------------------------------------------------------
  // 4.15 PauseProduction / Resume / 4.16 CompleteProduction
  // -------------------------------------------------------------------------

  this.on('pauseProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'IN_PROGRESS') return req.error(400, 'Production cannot be paused unless it is in progress');

    await tx.run(UPDATE(ProductionOrders).set({ status: 'PAUSED' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  this.on('completeProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (!['IN_PROGRESS', 'QUALITY_CHECK'].includes(prod.status)) {
      return req.error(400, `Production cannot be completed from status ${prod.status}`);
    }

    await tx.run(UPDATE(ProductionOrders).set({ status: 'COMPLETED', actualEnd: new Date() }).where({ ID: prodId }));

    const orderId = prod.parent_ID;
    await consumeReservationsForOrder(tx, orderId);

    const remaining = await tx.run(SELECT.from(ProductionOrders)
      .where({ parent_ID: orderId, status: { '!=': 'COMPLETED', and: { status: { '!=': 'CANCELLED' } } } }));
    // [ASSUMPTION] если у CDS-конструктора не устроит такой where — эквивалент:
    // .where(`parent_ID = ${orderId} and status not in ('COMPLETED','CANCELLED')`)
    if (!remaining.length) {
      await tx.run(UPDATE(SalesOrders).set({ status: 'READY' }).where({ ID: orderId }));
    }

    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  // -------------------------------------------------------------------------
  // 4.16 (fallback) MarkOrderReady — ручной триггер, на случай если менеджер
  // хочет форсировать READY, не дожидаясь completeProduction на каждой позиции.
  // -------------------------------------------------------------------------

  this.on('markOrderReady', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'IN_PRODUCTION') return req.error(400, `Order cannot be marked ready from status ${order.status}`);

    const unfinished = await tx.run(SELECT.from(ProductionOrders)
      .where({ parent_ID: orderId, status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED', 'QUALITY_CHECK', 'REWORK'] } }));
    if (unfinished.length) return req.error(400, 'Order has production orders that are not yet completed');

    await tx.run(UPDATE(SalesOrders).set({ status: 'READY' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  // -------------------------------------------------------------------------
  // 4.18 / 4.19 RegisterPayment
  // -------------------------------------------------------------------------

  this.on('registerPayment', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const { amount, method, paidAt } = req.data;
    const tx = this.tx(req);

    if (!(Number(amount) > 0)) return req.error(400, 'Payment amount must be greater than zero');
    if (!method) return req.error(400, 'Payment method is required');

    const order = await tx.run(SELECT.one.from(SalesOrders).columns('totalAmount', 'paidAmount').where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');

    const balanceDue = Number(order.totalAmount) - Number(order.paidAmount || 0);
    if (Number(amount) > balanceDue) {
      return req.error(400, `Payment amount exceeds the remaining balance (${balanceDue.toFixed(2)})`);
    }

    const [payment] = await tx.run(INSERT.into(Payments).entries({
      parent_ID: orderId, amount, method, paidAt: paidAt || new Date(), status: 'COMPLETED',
    }).returning('*'));

    const newPaidAmount = Number((Number(order.paidAmount || 0) + Number(amount)).toFixed(2));
    const paymentStatus = newPaidAmount >= Number(order.totalAmount) ? 'PAID'
                          : newPaidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    await tx.run(UPDATE(SalesOrders).set({ paidAmount: newPaidAmount, paymentStatus }).where({ ID: orderId }));

    return payment;
  });

  this.before('CREATE', 'Deliveries', async (req) => {
    const { parent_ID } = req.data;
    if (!parent_ID) return; // на всякий случай, вдруг create без parent
    const [order] = await SELECT.from('SalesOrderService.SalesOrders').columns('status').where({ ID: parent_ID });
    if (order && order.status !== 'READY') {
      req.error(400, 'Delivery can only be scheduled for an order that is READY');
    }
  });

  this.before(['CREATE', 'UPDATE'], 'BillOfMaterials', (req) => {
    const { quantityPerUnit } = req.data;
    if (quantityPerUnit != null && Number(quantityPerUnit) <= 0) {
      req.error(400, 'Quantity per unit must be greater than zero');
    }
  });

  // -------------------------------------------------------------------------
  // Materials / Warehouses — addStock, transferMaterial
  // -------------------------------------------------------------------------

  this.on('addStock', async (req) => {
    const { material_ID, warehouse_ID, quantity, reorderThreshold, criticalThreshold } = req.data;
    const tx = this.tx(req);

    if (!(Number(quantity) > 0)) return req.error(400, 'Quantity must be greater than zero');

    const [existing] = await tx.run(SELECT.from(MaterialStocks)
      .where({ material_ID, warehouse_ID }));

    if (existing) {
      await tx.run(UPDATE(MaterialStocks).set('quantityOnHand +=', quantity).where({ ID: existing.ID }));
    } else {
      await tx.run(INSERT.into(MaterialStocks).entries({
        material_ID, warehouse_ID, quantityOnHand: quantity, reservedQuantity: 0,
        reorderThreshold: reorderThreshold || 0, criticalThreshold: criticalThreshold || 0,
      }));
    }

    await refreshMaterialStatus(tx, material_ID);
    const [result] = await tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID }));
    return result;
  });

  this.on('transferMaterial', async (req) => {
    const { material_ID, fromWarehouse_ID, toWarehouse_ID, quantity } = req.data;
    const tx = this.tx(req);

    if (fromWarehouse_ID === toWarehouse_ID) return req.error(400, 'Source and target warehouse must differ');
    if (!(Number(quantity) > 0)) return req.error(400, 'Quantity must be greater than zero');

    const [fromStock] = await tx.run(SELECT.from(MaterialStocks)
      .where({ material_ID, warehouse_ID: fromWarehouse_ID }));
    if (!fromStock) return req.error(404, 'Source warehouse has no stock of this material');

    const available = Number(fromStock.quantityOnHand) - Number(fromStock.reservedQuantity);
    if (available < Number(quantity)) {
      return req.error(400, `Not enough available stock to transfer (available: ${available})`);
    }

    await tx.run(UPDATE(MaterialStocks).set('quantityOnHand -=', quantity).where({ ID: fromStock.ID }));

    const [toStock] = await tx.run(SELECT.from(MaterialStocks)
      .where({ material_ID, warehouse_ID: toWarehouse_ID }));
    if (toStock) {
      await tx.run(UPDATE(MaterialStocks).set('quantityOnHand +=', quantity).where({ ID: toStock.ID }));
    } else {
      await tx.run(INSERT.into(MaterialStocks).entries({
        material_ID, warehouse_ID: toWarehouse_ID, quantityOnHand: quantity,
        reservedQuantity: 0, reorderThreshold: fromStock.reorderThreshold, criticalThreshold: fromStock.criticalThreshold,
      }));
    }

    await refreshMaterialStatus(tx, material_ID);
    return tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID: [fromWarehouse_ID, toWarehouse_ID] }));
  });

  // -------------------------------------------------------------------------
  // MaterialStocks — пересчёт Material.status после ЛЮБОЙ ручной правки
  // (AdjustStock через обычный PATCH теперь тоже держит статус в актуальном состоянии)
  // -------------------------------------------------------------------------

  this.after(['CREATE', 'UPDATE'], 'MaterialStocks', async (data, req) => {
    const rows = Array.isArray(data) ? data : [data];
    const tx = this.tx(req);
    for (const row of rows) {
      if (row && row.material_ID) await refreshMaterialStatus(tx, row.material_ID);
    }
  });

  // -------------------------------------------------------------------------
  // ProductionOrders — полная машина состояний
  // -------------------------------------------------------------------------

  this.on('resumeProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (!['PAUSED', 'REWORK'].includes(prod.status)) {
      return req.error(400, `Production cannot be resumed from status ${prod.status}`);
    }
    await tx.run(UPDATE(ProductionOrders).set({ status: 'IN_PROGRESS' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  this.on('sendToQualityCheck', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'IN_PROGRESS') {
      return req.error(400, `Only production in progress can be sent to quality check (current: ${prod.status})`);
    }
    await tx.run(UPDATE(ProductionOrders).set({ status: 'QUALITY_CHECK' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  this.on('sendToRework', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'QUALITY_CHECK') {
      return req.error(400, `Only production in quality check can be sent to rework (current: ${prod.status})`);
    }
    await tx.run(UPDATE(ProductionOrders).set({ status: 'REWORK' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  this.on('cancelProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (['COMPLETED', 'CANCELLED'].includes(prod.status)) {
      return req.error(400, `Production already ${prod.status.toLowerCase()}`);
    }
    await tx.run(UPDATE(ProductionOrders).set({ status: 'CANCELLED' }).where({ ID: prodId }));
    // Материалы под этот заказ остаются зарезервированы на уровне заказа — если производство отменяется
    // отдельно от заказа (например, брак и пересоздание), релиз резерва должен быть осознанным решением
    // менеджера через CancelOrder, а не автоматическим следствием отмены одного production run.
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  // completeProduction — ужесточаем: теперь только из QUALITY_CHECK, как в твоей исходной диаграмме 4.14
  this.on('completeProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = this.tx(req);

    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'QUALITY_CHECK') {
      return req.error(400, `Production can only be completed from quality check (current: ${prod.status})`);
    }

    await tx.run(UPDATE(ProductionOrders).set({ status: 'COMPLETED', actualEnd: new Date() }).where({ ID: prodId }));

    const orderId = prod.parent_ID;
    await consumeReservationsForOrder(tx, orderId);

    const remaining = await tx.run(SELECT.from(ProductionOrders)
      .where({ parent_ID: orderId, status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED', 'QUALITY_CHECK', 'REWORK'] } }));
    if (!remaining.length) {
      await tx.run(UPDATE(SalesOrders).set({ status: 'READY' }).where({ ID: orderId }));
    }

    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  // -------------------------------------------------------------------------
  // Deliveries — запрет PATCH на статус + 3 lifecycle actions
  // -------------------------------------------------------------------------

  this.before('UPDATE', 'Deliveries', (req) => {
    if ('status' in req.data) {
      req.error(400, 'Delivery status cannot be changed directly — use the appropriate action');
    }
  });

  this.on('startDelivery', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const delivery = await tx.run(SELECT.one.from('SalesOrderService.Deliveries').where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'SCHEDULED') return req.error(400, `Delivery cannot start from status ${delivery.status}`);
    await tx.run(UPDATE('SalesOrderService.Deliveries').set({ status: 'IN_TRANSIT' }).where({ ID: id }));
    return tx.run(SELECT.one.from('SalesOrderService.Deliveries').where({ ID: id }));
  });

  this.on('markDelivered', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const delivery = await tx.run(SELECT.one.from('SalesOrderService.Deliveries').where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'IN_TRANSIT') return req.error(400, `Delivery cannot be marked delivered from status ${delivery.status}`);

    await tx.run(UPDATE('SalesOrderService.Deliveries').set({ status: 'DELIVERED', deliveredAt: new Date() }).where({ ID: id }));
    await tx.run(UPDATE(SalesOrders).set({ status: 'DELIVERED' }).where({ ID: delivery.parent_ID }));
    return tx.run(SELECT.one.from('SalesOrderService.Deliveries').where({ ID: id }));
  });

  this.on('markDeliveryFailed', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = this.tx(req);
    const delivery = await tx.run(SELECT.one.from('SalesOrderService.Deliveries').where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'IN_TRANSIT') return req.error(400, `Delivery cannot fail from status ${delivery.status}`);
    await tx.run(UPDATE('SalesOrderService.Deliveries').set({ status: 'FAILED' }).where({ ID: id }));
    return tx.run(SELECT.one.from('SalesOrderService.Deliveries').where({ ID: id }));
  });
});

