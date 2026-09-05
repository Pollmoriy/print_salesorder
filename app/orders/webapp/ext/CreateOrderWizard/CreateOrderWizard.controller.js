sap.ui.define([
  "sap/fe/core/PageController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (PageController, JSONModel, Fragment, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return PageController.extend("printflow.orders.ext.CreateOrderWizard.CreateOrderWizard", {

    onInit: function () {
      PageController.prototype.onInit.apply(this, arguments);

      const oDraftModel = new JSONModel({
        customer: null,
        urgencyLevel: "STANDARD",
        requestedDeliveryDate: null,
        discountPercent: 0,
        items: [],
        orderTotal: 0,
        busy: false,
        steps: {
          customer: { valid: false },
          products: { valid: false }
        }
      });
      this.getView().setModel(oDraftModel, "draft");
    },

    // --- Step 1: Customer ---
    onCustomerValueHelp: async function () {
      if (!this._pCustomerVH) {
        this._pCustomerVH = Fragment.load({
          id: this.getView().getId(),
          name: "printflow.orders.ext.CreateOrderWizard.CustomerValueHelp",
          controller: this
        }).then((oDialog) => {
          this.getView().addDependent(oDialog);
          return oDialog;
        });
      }
      const oDialog = await this._pCustomerVH;
      oDialog.open();
    },

    onCustomerSearch: function (oEvent) {
      const sValue = oEvent.getParameter("value");
      const oBinding = oEvent.getSource().getBinding("items");
      oBinding.filter(sValue ? [new Filter("name", FilterOperator.Contains, sValue)] : []);
    },

    onCustomerSelected: function (oEvent) {
      const oContext = oEvent.getParameter("selectedItem")?.getBindingContext();
      if (!oContext) return;
      const oCustomerData = oContext.getObject();
      const oDraft = this.getView().getModel("draft");
      oDraft.setProperty("/customer", { ID: oCustomerData.ID, name: oCustomerData.name });
      oDraft.setProperty("/steps/customer/valid", true);
    },

    // --- Step 2: Products ---
    onAddItem: function () {
      const oDraft = this.getView().getModel("draft");
      const aItems = oDraft.getProperty("/items");
      aItems.push({ productId: null, productName: "", quantity: 1, unitPrice: 0, finishingOptions: "", lineTotal: 0 });
      oDraft.setProperty("/items", aItems);
      this._recalculateTotals();
    },

    onDeleteItem: function (oEvent) {
      const oDraft = this.getView().getModel("draft");
      const oItemContext = oEvent.getSource().getBindingContext("draft");
      const iIndex = parseInt(oItemContext.getPath().split("/").pop(), 10);
      const aItems = oDraft.getProperty("/items");
      aItems.splice(iIndex, 1);
      oDraft.setProperty("/items", aItems);
      this._recalculateTotals();
    },

    onProductValueHelp: async function (oEvent) {
      this._sCurrentItemPath = oEvent.getSource().getBindingContext("draft").getPath();
      if (!this._pProductVH) {
        this._pProductVH = Fragment.load({
          id: this.getView().getId(),
          name: "printflow.orders.ext.CreateOrderWizard.ProductValueHelp",
          controller: this
        }).then((oDialog) => {
          this.getView().addDependent(oDialog);
          return oDialog;
        });
      }
      const oDialog = await this._pProductVH;
      oDialog.open();
    },

    onProductSearch: function (oEvent) {
      const sValue = oEvent.getParameter("value");
      const oBinding = oEvent.getSource().getBinding("items");
      oBinding.filter(sValue ? [new Filter("name", FilterOperator.Contains, sValue)] : []);
    },

    onProductSelected: function (oEvent) {
      const oContext = oEvent.getParameter("selectedItem")?.getBindingContext();
      if (!oContext || !this._sCurrentItemPath) return;
      const oProduct = oContext.getObject();
      const oDraft = this.getView().getModel("draft");
      oDraft.setProperty(this._sCurrentItemPath + "/productId", oProduct.ID);
      oDraft.setProperty(this._sCurrentItemPath + "/productName", oProduct.name);
      oDraft.setProperty(this._sCurrentItemPath + "/unitPrice", oProduct.basePrice || 0);
      this._recalculateTotals();
    },

    onQuantityChange: function () {
      this._recalculateTotals();
    },

    _recalculateTotals: function () {
      const oDraft = this.getView().getModel("draft");
      const aItems = oDraft.getProperty("/items") || [];
      let bAllValid = aItems.length > 0;
      let fSubtotal = 0;

      aItems.forEach((oItem) => {
        const fQty = Number(oItem.quantity) || 0;
        const fPrice = Number(oItem.unitPrice) || 0;
        oItem.lineTotal = +(fQty * fPrice).toFixed(2);
        fSubtotal += oItem.lineTotal;
        if (!oItem.productId || fQty <= 0) bAllValid = false;
      });

      const fDiscount = Number(oDraft.getProperty("/discountPercent")) || 0;
      const fTotal = +(fSubtotal * (1 - fDiscount / 100)).toFixed(2);

      oDraft.setProperty("/items", aItems);
      oDraft.setProperty("/orderTotal", fTotal);
      oDraft.setProperty("/steps/products/valid", bAllValid);
    },

    // --- Navigation ---
    onNavBack: function () {
      this.getAppComponent().getRouter().navTo("SalesOrdersList");
    },

    // --- Step 4: Confirmation — Stage 2 mock flow (no backend write yet;
    // real deep-insert + draft activation comes in Stage 3-4, see plan) ---

    onSaveDraft: function () {
      const oDraft = this.getView().getModel("draft").getData();
      MessageToast.show(
        this.getView().getModel("i18n").getResourceBundle()
          .getText("draftSaved", [oDraft.customer?.name || ""])
      );
      this.onNavBack();
    },

    onSubmitOrder: function () {
      const oDraft = this.getView().getModel("draft").getData();
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      MessageBox.success(
        oBundle.getText("orderSubmittedDetail", [
          oDraft.customer?.name || "",
          oDraft.items.length,
          oDraft.orderTotal
        ]),
        {
          title: oBundle.getText("orderSubmitted"),
          onClose: () => this.onNavBack()
        }
      );
    },

    onWizardComplete: function () {
      const oWizard = this.byId("orderWizard");
      const oSummaryStep = this.byId("stepSummary");
      oWizard.goToStep(oSummaryStep);
    },
  });
});