const cds = require('@sap/cds');
const { recalcOrderTotals, reserveMaterialsForOrder, releaseReservationsForOrder } = require('./lib/tx-helpers');

module.exports = (srv) => {
  const db = cds.db;
  const { SalesOrders, OrderItems, ProductionOrders, MaterialReservations } = cds.entities('printflow.db');

  srv.on('checkMaterialAvailability', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];

    const items = await SELECT.from('SalesOrderService.OrderItems')
      .columns('product_ID', 'quantity').where({ parent_ID: orderId });
    if (!items.length) return [];

    const productIds = [...new Set(items.map(i => i.product_ID))];
    const products = await SELECT.from('SalesOrderService.Products')
      .columns('ID', 'code').where({ ID: productIds });
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

    const materials = await SELECT.from('SalesOrderService.Materials')
      .columns('ID', 'code', 'name', 'unit').where({ code: materialCodes });

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
        materialCode: m.code, materialName: m.name, unit: m.unit,
        requiredQty, availableQty, sufficient: availableQty >= requiredQty,
      };
    });
  });

  srv.on('getOrderSummary', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const [order] = await SELECT.from('SalesOrderService.SalesOrders')
      .columns('totalAmount', 'discountPercent', 'paidAmount', 'balanceDue')
      .where({ ID: orderId });
    return order;
  });

  srv.on('submitOrder', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);

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

  srv.on('confirmOrder', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'SUBMITTED') return req.error(400, `Order cannot be confirmed from status ${order.status}`);

    try { await reserveMaterialsForOrder(tx, orderId); }
    catch (e) { return req.error(e.code || 400, e.message); }

    await tx.run(UPDATE(SalesOrders).set({ status: 'CONFIRMED' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  const CANCELLABLE_FROM = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'IN_PRODUCTION', 'READY'];

  srv.on('cancelOrder', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (!CANCELLABLE_FROM.includes(order.status)) return req.error(400, `Order cannot be cancelled from status ${order.status}`);

    await releaseReservationsForOrder(tx, orderId);
    await tx.run(UPDATE(ProductionOrders).set({ status: 'CANCELLED' })
      .where({ parent_ID: orderId, status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED', 'QUALITY_CHECK', 'REWORK'] } }));
    await tx.run(UPDATE(SalesOrders).set({ status: 'CANCELLED' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  srv.on('startProduction', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'CONFIRMED') return req.error(400, `Production cannot be started for order in status ${order.status}`);

    const activeReservations = await tx.run(SELECT.from(MaterialReservations).where({ order_ID: orderId, status: 'ACTIVE' }));
    if (!activeReservations.length) {
      try { await reserveMaterialsForOrder(tx, orderId); }
      catch (e) { return req.error(e.code || 400, e.message); }
    }

    const daysByUrgency = { STANDARD: 5, EXPRESS: 3, URGENT: 1 };
    const days = daysByUrgency[order.urgencyLevel] || 5;
    const now = new Date();
    const estimatedCompletion = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await tx.run(INSERT.into(ProductionOrders).entries({
      ID: cds.utils.uuid(), parent_ID: orderId,
      status: 'PLANNED', plannedStart: now, estimatedCompletion,
    }));

    await tx.run(UPDATE(SalesOrders).set({ status: 'IN_PRODUCTION' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });

  srv.on('markOrderReady', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);

    const order = await tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');
    if (order.status !== 'IN_PRODUCTION') return req.error(400, `Order cannot be marked ready from status ${order.status}`);

    const unfinished = await tx.run(SELECT.from(ProductionOrders)
      .where({ parent_ID: orderId, status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED', 'QUALITY_CHECK', 'REWORK'] } }));
    if (unfinished.length) return req.error(400, 'Order has production orders that are not yet completed');

    await tx.run(UPDATE(SalesOrders).set({ status: 'READY' }).where({ ID: orderId }));
    return tx.run(SELECT.one.from(SalesOrders).where({ ID: orderId }));
  });
};