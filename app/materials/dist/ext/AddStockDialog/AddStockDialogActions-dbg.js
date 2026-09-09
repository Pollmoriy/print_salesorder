sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/core/Element",
  "sap/m/MessageToast"
], function (Fragment, Element, MessageToast) {
  "use strict";

  let _oDialog = null;
  let _oMaterialContext = null;

  async function getDialog() {
    if (!_oDialog) {
      _oDialog = await Fragment.load({
        name: "printflow.materials.ext.AddStockDialog.AddStockDialog",
        controller: {
          onConfirmAddStock: onConfirmAddStock,
          onCancelAddStock: onCancelAddStock
        }
      });
      _oDialog.setModel(_oMaterialContext.getModel());
    }
    return _oDialog;
  }

  async function onConfirmAddStock(oEvent) {
    const oDialog = oEvent.getSource().getParent();

    const sWarehouseId = Element.getElementById("warehouseSelect").getSelectedKey();
    const sQty = Element.getElementById("qtyInput").getValue();
    const sReorder = Element.getElementById("reorderInput").getValue();
    const sCritical = Element.getElementById("criticalInput").getValue();

    if (!sWarehouseId) { MessageToast.show("Please select a warehouse"); return; }
    if (!sQty || Number(sQty) <= 0) { MessageToast.show("Please enter a valid quantity"); return; }

    const oModel = _oMaterialContext.getModel();
    const oOperation = oModel.bindContext("/addStock(...)"); 
    oOperation.setParameter("material_ID", _oMaterialContext.getObject().ID);
    oOperation.setParameter("warehouse_ID", sWarehouseId);
    oOperation.setParameter("quantity", Number(sQty));
    oOperation.setParameter("reorderThreshold", Number(sReorder) || 0);
    oOperation.setParameter("criticalThreshold", Number(sCritical) || 0);

    try {
      await oOperation.execute();
      _oMaterialContext.getBinding().refresh(); 
      MessageToast.show("Stock updated");
      oDialog.close();
    } catch (e) {
      MessageToast.show(e.message || "Failed to add stock");
    }
  }

  function onCancelAddStock(oEvent) {
    oEvent.getSource().getParent().close();
  }

  return {
    onAddToWarehouse: async function (oBindingContext, aSelectedContexts) {
      _oMaterialContext = oBindingContext;
      const oDialog = await getDialog();
      oDialog.open();
    }
  };
});