const cds = require('@sap/cds');
const { refreshMaterialStatus } = require('./lib/tx-helpers');

module.exports = (srv) => {
  const db = cds.db;
  const { MaterialStocks } = cds.entities('printflow.db');

  srv.on('addStock', async (req) => {
    const { material_ID, warehouse_ID, quantity, reorderThreshold, criticalThreshold } = req.data;
    const tx = db.tx(req);
    if (!(Number(quantity) > 0)) return req.error(400, 'Quantity must be greater than zero');

    const [existing] = await tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID }));
    if (existing) {
      await tx.run(UPDATE(MaterialStocks).set('quantityOnHand +=', quantity).where({ ID: existing.ID }));
    } else {
      await tx.run(INSERT.into(MaterialStocks).entries({
        ID: cds.utils.uuid(), material_ID, warehouse_ID, quantityOnHand: quantity, reservedQuantity: 0,
        reorderThreshold: reorderThreshold || 0, criticalThreshold: criticalThreshold || 0,
      }));
    }
    await refreshMaterialStatus(tx, material_ID);
    const [result] = await tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID }));
    return result;
  });

  srv.on('transferMaterial', async (req) => {
    const { material_ID, fromWarehouse_ID, toWarehouse_ID, quantity } = req.data;
    const tx = db.tx(req);

    if (fromWarehouse_ID === toWarehouse_ID) return req.error(400, 'Source and target warehouse must differ');
    if (!(Number(quantity) > 0)) return req.error(400, 'Quantity must be greater than zero');

    const [fromStock] = await tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID: fromWarehouse_ID }));
    if (!fromStock) return req.error(404, 'Source warehouse has no stock of this material');

    const available = Number(fromStock.quantityOnHand) - Number(fromStock.reservedQuantity);
    if (available < Number(quantity)) return req.error(400, `Not enough available stock to transfer (available: ${available})`);

    await tx.run(UPDATE(MaterialStocks).set('quantityOnHand -=', quantity).where({ ID: fromStock.ID }));

    const [toStock] = await tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID: toWarehouse_ID }));
    if (toStock) {
      await tx.run(UPDATE(MaterialStocks).set('quantityOnHand +=', quantity).where({ ID: toStock.ID }));
    } else {
      await tx.run(INSERT.into(MaterialStocks).entries({
        ID: cds.utils.uuid(), material_ID, warehouse_ID: toWarehouse_ID, quantity,
        reservedQuantity: 0, reorderThreshold: fromStock.reorderThreshold, criticalThreshold: fromStock.criticalThreshold,
      }));
    }
    await refreshMaterialStatus(tx, material_ID);
    return tx.run(SELECT.from(MaterialStocks).where({ material_ID, warehouse_ID: [fromWarehouse_ID, toWarehouse_ID] }));
  });
};