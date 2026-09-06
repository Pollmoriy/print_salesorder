sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Fragment, JSONModel, MessageToast) {
  "use strict";

  let _oDialog = null;

  async function getDialog() {
    if (!_oDialog) {
      _oDialog = await Fragment.load({
        name: "printflow.orders.ext.MaterialsRequired.MaterialsRequiredDialog",
        controller: {
          onReserveMaterials: function () {
            MessageToast.show("Coming soon: reserveMaterials() → CAP action");
          },
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
      try {
        const oOrderContext = oBindingContext.getBinding
          ? oBindingContext.getBinding().getHeaderContext
            ? oBindingContext.getBinding().getHeaderContext()
            : oBindingContext
          : oBindingContext;

        const oModel = oOrderContext.getModel();
        const oOperation = oModel.bindContext("SalesOrderService.materialsRequired(...)", oOrderContext);

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