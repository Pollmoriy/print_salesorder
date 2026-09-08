sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Fragment, JSONModel, MessageToast) {
  "use strict";

  let _oDialog = null;
  let _oOrderContext = null;

  async function onReserveMaterials() {
    const sStatus = _oOrderContext.getProperty("status");

    if (sStatus === "CONFIRMED") {
      MessageToast.show("Materials are already reserved for this order");
      return;
    }
    if (sStatus !== "SUBMITTED") {
      MessageToast.show(`Cannot reserve materials from status ${sStatus}`);
      return;
    }

    const oModel = _oOrderContext.getModel();
    const oOperation = oModel.bindContext("SalesOrderService.confirmOrder(...)", _oOrderContext);

    try {
      await oOperation.execute();
      _oOrderContext.getBinding().refresh();
      MessageToast.show("Materials reserved, order confirmed");
    } catch (e) {
      MessageToast.show(e.message || "Failed to reserve materials");
    }
  }

  async function getDialog() {
    if (!_oDialog) {
      _oDialog = await Fragment.load({
        name: "printflow.orders.ext.MaterialsRequired.MaterialsRequiredDialog",
        controller: {
          onReserveMaterials: onReserveMaterials,
          onCloseMaterialsDialog: function (oEvent) {
            oEvent.getSource().getParent().close();
          }
        }
      });
    }
    return _oDialog;
  }

  return {
    onCheckMaterials: async function (oBindingContext, aSelectedContexts) {
      _oOrderContext = oBindingContext.getBinding
        ? oBindingContext.getBinding().getHeaderContext
          ? oBindingContext.getBinding().getHeaderContext()
          : oBindingContext
        : oBindingContext;

      try {
        const oModel = _oOrderContext.getModel();
        const oOperation = oModel.bindContext("SalesOrderService.checkMaterialAvailability(...)", _oOrderContext);
        await oOperation.execute();

        const oResult = oOperation.getBoundContext().getObject();
        const aItems = Array.isArray(oResult) ? oResult : (oResult && oResult.value) || [];

        const oDialog = await getDialog();
        oDialog.setModel(new JSONModel({ items: aItems }), "materials");
        oDialog.open();
      } catch (e) {
        console.error("MaterialsRequired.onCheckMaterials failed:", e);
        MessageToast.show("Failed to check materials: " + e.message);
      }
    }
  };
});