sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/ui/core/Element",
  "sap/m/MessageToast"
], function (Fragment, Element, MessageToast) {
  "use strict";

  let _oDialog = null;
  let _oOrderContext = null;

  async function getDialog() {
    if (!_oDialog) {
      _oDialog = await Fragment.load({
        name: "printflow.orders.ext.DeliveryDialog.DeliveryDialog",
        controller: {
          onConfirmScheduleDelivery: onConfirmScheduleDelivery,
          onCancelScheduleDelivery: onCancelScheduleDelivery
        }
      });
    }
    return _oDialog;
  }

  async function onConfirmScheduleDelivery(oEvent) {
    const oDialog = oEvent.getSource().getParent();

    const sAddress = Element.getElementById("deliveryAddressInput").getValue();
    const sDate = Element.getElementById("deliveryDatePicker").getValue();

    if (!sAddress || !sDate) {
      MessageToast.show("Please fill in address and date");
      return;
    }

    const oModel = _oOrderContext.getModel();
    const oListBinding = oModel.bindList("deliveries", _oOrderContext);
    const oNewContext = oListBinding.create({
      address: sAddress,
      scheduledDate: sDate,
      status: "SCHEDULED"
    });

    try {
      await oNewContext.created();
      MessageToast.show("Delivery scheduled");
      oDialog.close();
    } catch (e) {
      MessageToast.show("Failed to schedule delivery: " + e.message);
    }
  }

  function onCancelScheduleDelivery(oEvent) {
    oEvent.getSource().getParent().close();
  }

  return {
    onScheduleDelivery: async function (oBindingContext, aSelectedContexts) {
      _oOrderContext = oBindingContext;
      const oDialog = await getDialog();
      oDialog.open();
    }
  };
});