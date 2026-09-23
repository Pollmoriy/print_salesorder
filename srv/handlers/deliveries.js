const cds = require('@sap/cds');

module.exports = (srv) => {
  const db = cds.db;
  const { SalesOrders, Deliveries } = cds.entities('printflow.db');

  srv.before('UPDATE', 'Deliveries', (req) => {
    if ('status' in req.data) req.error(400, 'Delivery status cannot be changed directly — use the appropriate action');
  });

  srv.on('scheduleDelivery', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const { address, scheduledDate } = req.data;
    const tx = db.tx(req);
    const delivery = await tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'NOT_SCHEDULED') return req.error(400, `Delivery cannot be scheduled from status ${delivery.status}`);
    if (!address || !scheduledDate) return req.error(400, 'Address and scheduled date are required');

    await tx.run(UPDATE(Deliveries).set({ status: 'SCHEDULED', address, scheduledDate }).where({ ID: id }));
    return tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
  });

  srv.on('startDelivery', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const delivery = await tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'SCHEDULED') return req.error(400, `Delivery cannot start from status ${delivery.status}`);
    await tx.run(UPDATE(Deliveries).set({ status: 'IN_TRANSIT' }).where({ ID: id }));
    return tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
  });

  srv.on('markDelivered', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const delivery = await tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'IN_TRANSIT') return req.error(400, `Delivery cannot be marked delivered from status ${delivery.status}`);

    await tx.run(UPDATE(Deliveries).set({ status: 'DELIVERED', deliveredAt: new Date() }).where({ ID: id }));
    await tx.run(UPDATE(SalesOrders).set({ status: 'DELIVERED' }).where({ ID: delivery.parent_ID }));
    return tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
  });

  srv.on('markDeliveryFailed', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const delivery = await tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'IN_TRANSIT') return req.error(400, `Delivery cannot fail from status ${delivery.status}`);
    await tx.run(UPDATE(Deliveries).set({ status: 'FAILED' }).where({ ID: id }));
    return tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
  });

  srv.on('retryDelivery', 'Deliveries', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const delivery = await tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
    if (!delivery) return req.error(404, 'Delivery not found');
    if (delivery.status !== 'FAILED') return req.error(400, `Only a failed delivery can be retried (current: ${delivery.status})`);
    await tx.run(UPDATE(Deliveries).set({ status: 'SCHEDULED' }).where({ ID: id }));
    return tx.run(SELECT.one.from(Deliveries).where({ ID: id }));
  });
};