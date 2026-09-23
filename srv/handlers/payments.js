const cds = require('@sap/cds');
const { recalcPaidAmount } = require('./lib/tx-helpers');

module.exports = (srv) => {
  const db = cds.db;
  const { SalesOrders, Payments } = cds.entities('printflow.db');

  srv.on('registerPayment', 'SalesOrders', async (req) => {
    const orderId = req.params[0].ID || req.params[0];
    const { amount, method, paidAt } = req.data;
    const tx = db.tx(req);

    if (!(Number(amount) > 0)) return req.error(400, 'Payment amount must be greater than zero');
    if (!method) return req.error(400, 'Payment method is required');

    const order = await tx.run(SELECT.one.from(SalesOrders).columns('totalAmount', 'paidAmount').where({ ID: orderId }));
    if (!order) return req.error(404, 'Order not found');

    const balanceDue = Number(order.totalAmount) - Number(order.paidAmount || 0);
    if (Number(amount) > balanceDue) {
      return req.error(400, `Payment amount exceeds the remaining balance (${balanceDue.toFixed(2)})`);
    }

    const paymentId = cds.utils.uuid();
    await tx.run(INSERT.into(Payments).entries({
      ID: paymentId, parent_ID: orderId, amount, method, paidAt: paidAt || new Date(), status: 'PENDING',
    }));
    return tx.run(SELECT.one.from(Payments).where({ ID: paymentId }));
  });

  srv.on('completePayment', 'Payments', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const payment = await tx.run(SELECT.one.from(Payments).where({ ID: id }));
    if (!payment) return req.error(404, 'Payment not found');
    if (payment.status !== 'PENDING') return req.error(400, `Payment cannot be completed from status ${payment.status}`);

    await tx.run(UPDATE(Payments).set({ status: 'COMPLETED' }).where({ ID: id }));
    await recalcPaidAmount(tx, payment.parent_ID);
    return tx.run(SELECT.one.from(Payments).where({ ID: id }));
  });

  srv.on('refund', 'Payments', async (req) => {
    const id = req.params[0].ID || req.params[0];
    const tx = db.tx(req);
    const payment = await tx.run(SELECT.one.from(Payments).where({ ID: id }));
    if (!payment) return req.error(404, 'Payment not found');
    if (payment.status !== 'COMPLETED') return req.error(400, `Only completed payments can be refunded (current: ${payment.status})`);

    await tx.run(UPDATE(Payments).set({ status: 'REFUNDED' }).where({ ID: id }));
    await recalcPaidAmount(tx, payment.parent_ID);
    return tx.run(SELECT.one.from(Payments).where({ ID: id }));
  });
};