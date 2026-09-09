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

      // Привязываем слушатель событий роутера
      const oRouter = this.getAppComponent().getRouter();
      oRouter.getRoute("CreateOrderWizard").attachPatternMatched(this._onRouteMatched, this);

      this._initDraftModel();
    },

    _initDraftModel: function () {
      const oDraftModel = new JSONModel({
        customer: null,
        urgencyLevel: "STANDARD",
        requestedDeliveryDate: null,
        discountPercent: 0,
        items: [],
        orderTotal: 0,
        busy: false,
        submitted: false, // Флаг, был ли заказ успешно отправлен
        steps: {
          customer: { valid: false },
          products: { valid: false }
        }
      });
      this.getView().setModel(oDraftModel, "draft");
    },

    _onRouteMatched: function () {
      const oDraftModel = this.getView().getModel("draft");
      
      
      if (!oDraftModel || oDraftModel.getProperty("/submitted")) {
        this._initDraftModel();
        
        const oWizard = this.byId("orderWizard");
        if (oWizard) {
          oWizard.discardProgress(this.byId("stepCustomer"));
        }
      }
    },

    onWizardComplete: function () {
      const oWizard = this.byId("orderWizard");
      const oStepSummary = this.byId("stepSummary");

      if (oWizard && oStepSummary) {
        oWizard.goToStep(oStepSummary);
      }
    },

    onNavBack: function () {
      this.getAppComponent().getRouter().navTo("SalesOrdersList");
    },

    onReviewPress: function () {
      const oWizard = this.byId("orderWizard");
      const oStepSummary = this.byId("stepSummary");
      if (oWizard && oStepSummary) {
        oWizard.goToStep(oStepSummary);
      }
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

    // --- Draft & Submit Operations ---
    _createDraftOrder: async function () {
      const oModel = this.getView().getModel();
      const oDraft = this.getView().getModel("draft").getData();

      const oListBinding = oModel.bindList("/SalesOrders");
      const oOrderContext = oListBinding.create({
        customer_ID: oDraft.customer.ID,
        urgencyLevel: oDraft.urgencyLevel,
        requestedDeliveryDate: oDraft.requestedDeliveryDate,
        discountPercent: Number(oDraft.discountPercent) || 0,
        totalAmount: Number(oDraft.orderTotal) || 0 
      });
      await oOrderContext.created();

      const oItemsBinding = oModel.bindList("items", oOrderContext);
      await Promise.all(oDraft.items.map((oItem) => {
        const fQty = Number(oItem.quantity) || 0;
        const fPrice = Number(oItem.unitPrice) || 0;
        const fLineTotal = +(fQty * fPrice).toFixed(2);

        return oItemsBinding.create({
          product_ID: oItem.productId,
          quantity: fQty,
          unitPrice: fPrice,
          finishingOptions: oItem.finishingOptions || "",
          lineTotal: fLineTotal 
        }).created();
      }));

      return oOrderContext;
    },

    _activateDraft: async function (oOrderContext) {
      const oModel = oOrderContext.getModel();
      const oOperation = oModel.bindContext("SalesOrderService.draftActivate(...)", oOrderContext);
      return oOperation.execute();
    },

    onSaveDraft: async function () {
      const oDraftModel = this.getView().getModel("draft");
      if (!oDraftModel.getProperty("/steps/customer/valid") || !oDraftModel.getProperty("/steps/products/valid")) {
        MessageToast.show("Fill in the client and at least one item before saving");
        return;
      }
      oDraftModel.setProperty("/busy", true);
      try {
        await this._createDraftOrder();
        oDraftModel.setProperty("/submitted", true); 
        MessageToast.show(
          this.getView().getModel("i18n").getResourceBundle()
            .getText("draftSaved", [oDraftModel.getProperty("/customer").name || ""])
        );
        this.onNavBack();
      } catch (oError) {
        MessageBox.error("Failed to save draft: " + (oError.message || oError));
      } finally {
        oDraftModel.setProperty("/busy", false);
      }
    },

    onSubmitOrder: async function () {
      const oDraftModel = this.getView().getModel("draft");
      if (!oDraftModel.getProperty("/steps/customer/valid") || !oDraftModel.getProperty("/steps/products/valid")) {
        MessageToast.show("Fill in the client and at least one item before sending");
        return;
      }
      
      oDraftModel.setProperty("/busy", true);
      try {
        const oOrderContext = await this._createDraftOrder();
        const oActiveContext = await this._activateDraft(oOrderContext);
        const oModel = this.getView().getModel();
        oModel.refresh();
        oDraftModel.setProperty("/submitted", true);
        MessageBox.success("The order has been saved and sent successfully!", {
          onClose: () => {
            this.onNavBack();
          }
        });
      } catch (oError) {
        MessageBox.error("Error saving: " + (oError.message || oError));
      } finally {
        oDraftModel.setProperty("/busy", false);
      }
    }
  });
});