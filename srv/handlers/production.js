const cds = require('@sap/cds');
const { consumeReservationsForOrder } = require('./lib/tx-helpers');

module.exports = (srv) => {
  const db = cds.db;
  const { SalesOrders, ProductionOrders } = cds.entities('printflow.db');

  srv.on('startProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'PLANNED') return req.error(400, `Production cannot start from status ${prod.status}`);

    await tx.run(UPDATE(ProductionOrders).set({ status: 'IN_PROGRESS', actualStart: new Date() }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  srv.on('pauseProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'IN_PROGRESS') return req.error(400, 'Production cannot be paused unless it is in progress');
    await tx.run(UPDATE(ProductionOrders).set({ status: 'PAUSED' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  srv.on('resumeProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (!['PAUSED', 'REWORK'].includes(prod.status)) return req.error(400, `Production cannot be resumed from status ${prod.status}`);
    await tx.run(UPDATE(ProductionOrders).set({ status: 'IN_PROGRESS' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  srv.on('sendToQualityCheck', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'IN_PROGRESS') return req.error(400, `Only production in progress can be sent to quality check (current: ${prod.status})`);
    await tx.run(UPDATE(ProductionOrders).set({ status: 'QUALITY_CHECK' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  srv.on('sendToRework', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'QUALITY_CHECK') return req.error(400, `Only production in quality check can be sent to rework (current: ${prod.status})`);
    await tx.run(UPDATE(ProductionOrders).set({ status: 'REWORK' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  srv.on('cancelProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (['COMPLETED', 'CANCELLED'].includes(prod.status)) return req.error(400, `Production already ${prod.status.toLowerCase()}`);
    await tx.run(UPDATE(ProductionOrders).set({ status: 'CANCELLED' }).where({ ID: prodId }));
    return tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
  });

  srv.on('completeProduction', 'ProductionOrders', async (req) => {
    const prodId = req.params[0].ID || req.params[0];
    const tx = db.tx(req);

    const prod = await tx.run(SELECT.one.from(ProductionOrders).where({ ID: prodId }));
    if (!prod) return req.error(404, 'Production order not found');
    if (prod.status !== 'QUALITY_CHECK') return req.error(400, `Production can only be completed from quality check (current: ${prod.status})`);

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
};