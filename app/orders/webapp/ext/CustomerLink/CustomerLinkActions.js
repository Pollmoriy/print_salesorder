sap.ui.define([], function () {
  "use strict";
  return {
    onOpenCustomer: function (oBindingContext) {
      if (!oBindingContext) return;
      const sCustomerId = oBindingContext.getObject().customer_ID;
      if (!sCustomerId) return;
      window.location.href =
        `${window.location.origin}/printflowcustomers/index.html#/Customers(ID=${sCustomerId},IsActiveEntity=true)`;
    }
  };
});