const cds = require('@sap/cds');

const URGENCY_SURCHARGE_RATE = { STANDARD: 0, EXPRESS: 0.08, URGENT: 0.15 };
const DELIVERY_FLAT_COST = 10;

function entities() {
  return cds.entities('printflow.db');
}

async function recalcOrderTotals(tx, orderId) {
  const { SalesOrders, OrderItems } = entities();
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

  await tx.run(UPDATE(SalesOrders).set({ totalAmount }).where({ ID: orderId }));
  return { subtotal, urgencySurcharge, deliveryCost, discount, totalAmount };
}

async function resolveMaterialsForOrder(tx, orderId) {
  const { OrderItems, Materials, MaterialStocks, BillOfMaterials, Products } = entities();
  const items = await tx.run(SELECT.from(OrderItems).columns('product_ID', 'quantity').where({ parent_ID: orderId }));
  if (!items.length) return [];

  const productIds = [...new Set(items.map(i => i.product_ID))];
  const products = await tx.run(SELECT.from(Products).columns('ID', 'code').where({ ID: productIds }));
  const codeByProductId = Object.fromEntries(products.map(p => [p.ID, p.code]));

  const productCodes = [...new Set(products.map(p => p.code))];
  const bom = productCodes.length
    ? await tx.run(SELECT.from(BillOfMaterials).columns('productCode', 'materialCode', 'quantityPerUnit').where({ productCode: productCodes }))
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

async function refreshMaterialStatus(tx, materialId) {
  const { Materials, MaterialStocks } = entities();
  const stocks = await tx.run(SELECT.from(MaterialStocks)
    .columns('quantityOnHand', 'reservedQuantity', 'reorderThreshold', 'criticalThreshold')
    .where({ material_ID: materialId }));
  if (!stocks.length) return;
  const totalAvailable = stocks.reduce((s, r) => s + (Number(r.quantityOnHand) - Number(r.reservedQuantity)), 0);
  const worstCritical = Math.min(...stocks.map(s => Number(s.criticalThreshold) || 0));
  const worstReorder = Math.min(...stocks.map(s => Number(s.reorderThreshold) || 0));

  let status = 'AVAILABLE';
  if (totalAvailable <= 0) status = 'OUT_OF_STOCK';
  else if (totalAvailable <= worstCritical) status = 'CRITICAL';
  else if (totalAvailable <= worstReorder) status = 'LOW_STOCK';

  await tx.run(UPDATE(Materials).set({ status }).where({ ID: materialId }));
}

async function reserveMaterialsForOrder(tx, orderId) {
  const { MaterialStocks, MaterialReservations } = entities();
  const resolved = await resolveMaterialsForOrder(tx, orderId);
  for (const r of resolved) {
    await tx.run(UPDATE(MaterialStocks).set('reservedQuantity +=', r.requiredQty).where({ ID: r.stockId }));
    await tx.run(INSERT.into(MaterialReservations).entries({
      ID: cds.utils.uuid(), order_ID: orderId, material_ID: r.materialId, warehouse_ID: r.warehouseId,
      quantity: r.requiredQty, status: 'ACTIVE',
    }));
    await refreshMaterialStatus(tx, r.materialId);
  }
}

async function releaseReservationsForOrder(tx, orderId) {
  const { MaterialStocks, MaterialReservations } = entities();
  const reservations = await tx.run(SELECT.from(MaterialReservations).where({ order_ID: orderId, status: 'ACTIVE' }));
  for (const res of reservations) {
    const [stock] = await tx.run(SELECT.from(MaterialStocks).columns('ID').where({ material_ID: res.material_ID, warehouse_ID: res.warehouse_ID }));
    if (stock) await tx.run(UPDATE(MaterialStocks).set('reservedQuantity -=', res.quantity).where({ ID: stock.ID }));
    await tx.run(UPDATE(MaterialReservations).set({ status: 'RELEASED' }).where({ ID: res.ID }));
    await refreshMaterialStatus(tx, res.material_ID);
  }
}

async function consumeReservationsForOrder(tx, orderId) {
  const { MaterialStocks, MaterialReservations } = entities();
  const reservations = await tx.run(SELECT.from(MaterialReservations).where({ order_ID: orderId, status: 'ACTIVE' }));
  for (const res of reservations) {
    const [stock] = await tx.run(SELECT.from(MaterialStocks).columns('ID').where({ material_ID: res.material_ID, warehouse_ID: res.warehouse_ID }));
    if (stock) {
      await tx.run(UPDATE(MaterialStocks)
        .set('quantityOnHand -=', res.quantity)
        .set('reservedQuantity -=', res.quantity)
        .where({ ID: stock.ID }));
    }
    await tx.run(UPDATE(MaterialReservations).set({ status: 'CONSUMED' }).where({ ID: res.ID }));
    await refreshMaterialStatus(tx, res.material_ID);
  }
}

async function recalcPaidAmount(tx, orderId) {
  const { SalesOrders, Payments } = entities();
  const completed = await tx.run(SELECT.from(Payments).columns('amount').where({ parent_ID: orderId, status: 'COMPLETED' }));
  const paidAmount = Number(completed.reduce((s, p) => s + Number(p.amount), 0).toFixed(2));
  const [order] = await tx.run(SELECT.from(SalesOrders).columns('totalAmount').where({ ID: orderId }));
  const paymentStatus = Number(order.totalAmount) > 0 && paidAmount >= Number(order.totalAmount) ? 'PAID'
                        : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  await tx.run(UPDATE(SalesOrders).set({ paidAmount, paymentStatus }).where({ ID: orderId }));
}

module.exports = {
  recalcOrderTotals,
  resolveMaterialsForOrder,
  reserveMaterialsForOrder,
  releaseReservationsForOrder,
  consumeReservationsForOrder,
  refreshMaterialStatus,
  recalcPaidAmount,
};