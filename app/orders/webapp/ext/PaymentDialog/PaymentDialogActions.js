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
    if (!sMethod) {
      MessageToast.show("Please select a payment method");
      return;
    }

    const oModel = _oOrderContext.getModel();
    const oOperation = oModel.bindContext("SalesOrderService.registerPayment(...)", _oOrderContext);
    oOperation.setParameter("amount", Number(sAmount));
    oOperation.setParameter("method", sMethod);
    oOperation.setParameter("paidAt", sDate ? `${sDate}T00:00:00Z` : null);

    try {
      await oOperation.execute();
      // action меняет paidAmount/paymentStatus на SalesOrders — обновляем страницу заказа
      _oOrderContext.getBinding().refresh();
      MessageToast.show("Payment registered");
      oDialog.close();
    } catch (e) {
      // сообщение придёт из req.error на бэкенде ("Payment amount exceeds the remaining balance...")
      MessageToast.show(e.message || "Failed to register payment");
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