sap.ui.define(["sap/m/MessageToast"], function (MessageToast) {
  "use strict";

  function toast(sActionName) {
    MessageToast.show(`Скоро: ${sActionName}() → CAP action`);
  }

  return {
    onCompletePayment: function () { toast("registerPayment"); },
    onRefund:          function () { toast("refundPayment"); }
  };
});