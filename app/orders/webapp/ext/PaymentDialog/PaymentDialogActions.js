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
        name: "printflow.orders.ext.PaymentDialog.PaymentDialog",
        controller: {
          onConfirmRegisterPayment: onConfirmRegisterPayment,
          onCancelRegisterPayment: onCancelRegisterPayment
        }
      });
    }
    return _oDialog;
  }

  async function onConfirmRegisterPayment(oEvent) {
    const oDialog = oEvent.getSource().getParent();

    const sAmount = Element.getElementById("paymentAmountInput").getValue();
    const sMethod = Element.getElementById("paymentMethodSelect").getSelectedKey();
    const sDate = Element.getElementById("paymentDatePicker").getValue();

    if (!sAmount || Number(sAmount) <= 0) {
      MessageToast.show("Please enter a valid amount");
      return;
    }

    const oModel = _oOrderContext.getModel();
    const oListBinding = oModel.bindList("payments", _oOrderContext);
    const oNewContext = oListBinding.create({
      amount: Number(sAmount),
      method: sMethod,
      paidAt: sDate ? `${sDate}T00:00:00Z` : null,
      status: "PENDING"
    });

    try {
      await oNewContext.created();
      MessageToast.show("Payment registered");
      oDialog.close();
    } catch (e) {
      MessageToast.show("Failed to register payment: " + e.message);
    }
  }

  function onCancelRegisterPayment(oEvent) {
    oEvent.getSource().getParent().close();
  }

  return {
    onRegisterPayment: async function (oBindingContext, aSelectedContexts) {
      _oOrderContext = oBindingContext;
      const oDialog = await getDialog();
      oDialog.open();
    }
  };
});