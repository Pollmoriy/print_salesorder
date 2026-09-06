sap.ui.define([], function () {
  "use strict";
  return {
    onCreatePress: function () {
      window.location.hash = "#/CreateOrderWizard";
    }
  };
});