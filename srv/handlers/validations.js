const cds = require('@sap/cds');

module.exports = (srv) => {
  srv.before(['CREATE', 'UPDATE'], 'OrderItems', (req) => {
    const { quantity, unitPrice, product_ID } = req.data;
    if (!product_ID) req.error(400, 'Product is required');
    if (quantity != null && Number(quantity) <= 0) req.error(400, 'Quantity must be greater than zero');
    if (unitPrice != null && Number(unitPrice) < 0) req.error(400, 'Unit price cannot be negative');
  });

  srv.before(['CREATE', 'UPDATE'], 'Payments', (req) => {
    const { amount, method } = req.data;
    if (amount != null && Number(amount) <= 0) req.error(400, 'Payment amount must be greater than zero');
    if (req.event === 'CREATE' && !method) req.error(400, 'Payment method is required');
  });

  srv.before(['CREATE', 'UPDATE'], 'Deliveries', (req) => {
    const { address, scheduledDate } = req.data;
    if (req.event === 'CREATE' && !address) req.error(400, 'Delivery address is required');
    if (scheduledDate && isNaN(Date.parse(scheduledDate))) req.error(400, 'Invalid scheduled date');
  });

  srv.before(['CREATE', 'UPDATE'], 'SalesOrders', async (req) => {
    const { discountPercent, requestedDeliveryDate, customer_ID } = req.data;

    if (req.event === 'CREATE') {
      if (!customer_ID) req.error(400, 'Customer is required');

      if (!req.data.orderNo) {
        const { SalesOrders } = cds.entities('printflow.db');
        const last = await SELECT.one.from(SalesOrders).columns('orderNo')
          .where(`orderNo like 'SO-1%'`).orderBy('orderNo desc');
        let nextNum = 1021;
        if (last?.orderNo) {
          const n = parseInt(last.orderNo.replace('SO-', ''), 10);
          if (!isNaN(n)) nextNum = n + 1;
        }
        req.data.orderNo = `SO-${nextNum}`;
      }
    }

    if (discountPercent != null && (Number(discountPercent) < 0 || Number(discountPercent) > 100)) {
      req.error(400, 'Discount must be between 0 and 100');
    }
    if (requestedDeliveryDate && isNaN(Date.parse(requestedDeliveryDate))) {
      req.error(400, 'Invalid requested delivery date');
    }
  });

  srv.before(['CREATE', 'UPDATE'], 'ProductionOrders', (req) => {
    const { plannedStart, plannedEnd, actualStart, actualEnd } = req.data;
    if (plannedStart && plannedEnd && new Date(plannedEnd) < new Date(plannedStart)) {
      req.error(400, 'Planned end cannot be before planned start');
    }
    if (actualStart && actualEnd && new Date(actualEnd) < new Date(actualStart)) {
      req.error(400, 'Actual end cannot be before actual start');
    }
  });

  srv.before(['CREATE', 'UPDATE'], 'Materials', (req) => {
    const { unitCost } = req.data;
    if (unitCost != null && Number(unitCost) < 0) req.error(400, 'Unit cost cannot be negative');
  });

  srv.before(['CREATE', 'UPDATE'], 'MaterialStocks', (req) => {
    const { quantityOnHand, reservedQuantity, reorderThreshold, criticalThreshold } = req.data;
    if (quantityOnHand != null && Number(quantityOnHand) < 0) req.error(400, 'Quantity on hand cannot be negative');
    if (reservedQuantity != null && Number(reservedQuantity) < 0) req.error(400, 'Reserved quantity cannot be negative');
    if (reorderThreshold != null && Number(reorderThreshold) < 0) req.error(400, 'Reorder threshold cannot be negative');
    if (criticalThreshold != null && Number(criticalThreshold) < 0) req.error(400, 'Critical threshold cannot be negative');
  });

  srv.before(['CREATE', 'UPDATE'], 'Products', (req) => {
    const { basePrice, code } = req.data;
    if (req.event === 'CREATE' && !code) req.error(400, 'Product code is required');
    if (basePrice != null && Number(basePrice) < 0) req.error(400, 'Base price cannot be negative');
  });

  srv.before(['CREATE', 'UPDATE'], 'Customers', (req) => {
    const { name, email } = req.data;
    if (req.event === 'CREATE' && !name) req.error(400, 'Customer name is required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) req.error(400, 'Invalid email format');
  });
};