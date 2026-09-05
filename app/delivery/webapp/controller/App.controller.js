sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Panel",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/m/Toolbar",
  "sap/m/ToolbarSpacer",
  "sap/m/Button",
  "sap/m/MessageToast",
  "sap/ui/core/Icon",
  "sap/ui/core/library"
], function (Controller, VBox, HBox, Panel, Text, ObjectStatus, Toolbar, ToolbarSpacer, Button, MessageToast, Icon, coreLibrary) {
  "use strict";

  const ValueState = coreLibrary.ValueState;

  const STAGES = [
    { key: "READY",      label: "Ready" },
    { key: "SCHEDULED",  label: "Scheduled" },
    { key: "IN_TRANSIT", label: "In Transit" },
    { key: "DELIVERED",  label: "Delivered" }
  ];

  const STATUS_TO_VALUESTATE = {
    NOT_SCHEDULED: ValueState.None,
    SCHEDULED: ValueState.Warning,
    IN_TRANSIT: ValueState.Information,
    DELIVERED: ValueState.Success,
    FAILED: ValueState.Error
  };

  return Controller.extend("printflow.delivery.controller.App", {

    onInit: function () {
      const oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        // eslint-disable-next-line no-console
        console.error("Default OData model is not configured — check manifest.json > sap.ui5.models");
        return;
      }
      this._sCurrentFilter = "ALL";
      this._loadList(oModel);
    },

    _loadList: async function (oModel) {
      const oBinding = oModel.bindList("/Deliveries", null, [], [], {
        $expand: "parent($select=orderNo,customer_ID;$expand=customer($select=name))"
      });

      try {
        const aContexts = await oBinding.requestContexts(0, 1000);
        this._aDeliveries = aContexts.map((oCtx) => oCtx.getObject());
        this._renderList();
      } catch (oError) {
        // eslint-disable-next-line no-console
        console.error("Failed to load Deliveries:", oError);
      }
    },

    onFilterChange: function (oEvent) {
      this._sCurrentFilter = oEvent.getSource().getSelectedKey();
      this._renderList();
    },

    _renderList: function () {
      const oContainer = this.byId("cardList");
      oContainer.destroyItems();

      const aFiltered = this._aDeliveries.filter((d) => {
        if (this._sCurrentFilter === "ALL") return true;
        return d.status === this._sCurrentFilter;
      });

      if (!aFiltered.length) {
        oContainer.addItem(new Text({ text: "No deliveries found." }).addStyleClass("emptyText"));
        return;
      }

      aFiltered.forEach((oDelivery) => {
        oContainer.addItem(this._buildTrackingCard(oDelivery));
      });
    },

    _buildTrackingCard: function (oDelivery) {
      const oParent = oDelivery.parent || {};
      const oCustomer = oParent.customer || {};

      const oCard = new Panel({ class: "trackingCard" }).addStyleClass("trackingCard");

      // --- Header row: Order / Customer left, Tracking right ---
      const oHeader = new HBox({ justifyContent: "SpaceBetween" });
      const oLeft = new VBox();
      oLeft.addItem(new Text({ text: oParent.orderNo || "—" }).addStyleClass("trackingOrderNo"));
      oLeft.addItem(new Text({ text: oCustomer.name || "—" }).addStyleClass("trackingCustomer"));
      oHeader.addItem(oLeft);

      const oRight = new VBox({ alignItems: "End" });
      if (oDelivery.trackingNumber) {
        oRight.addItem(new Text({ text: oDelivery.trackingNumber }).addStyleClass("trackingNumber"));
      }
      if (oDelivery.status === "FAILED") {
        oRight.addItem(new ObjectStatus({ text: "Failed", state: ValueState.Error }));
      }
      oHeader.addItem(oRight);
      oCard.addContent(oHeader);

      // --- Address / date line ---
      oCard.addContent(new Text({
        text: `${oDelivery.address || "No address"} · Scheduled: ${oDelivery.scheduledDate || "—"}`
      }).addStyleClass("trackingMeta"));

      // --- Horizontal progress rail ---
      oCard.addContent(this._buildRail(oDelivery.status));

      // --- Actions ---
      const aActions = this._getActions(oDelivery.status);
      if (aActions.length) {
        const oToolbar = new Toolbar();
        oToolbar.addContent(new ToolbarSpacer());
        aActions.forEach((oAction) => {
          oToolbar.addContent(new Button({
            text: oAction.text,
            icon: oAction.icon,
            press: () => this._onActionPress(oAction, oDelivery, oParent)
          }));
        });
        oCard.addContent(oToolbar);
      }

      return oCard;
    },

    _buildRail: function (sStatus) {
      const iCurrent = this._currentStageIndex(sStatus);
      const oRail = new HBox({ alignItems: "Center" }).addStyleClass("trackingRail");

      STAGES.forEach((oStage, iIndex) => {
        const bDone = iCurrent >= 0 && iIndex < iCurrent;
        const bActive = iIndex === iCurrent;
        const sColor = iCurrent < 0 ? "#bb0000" : bDone || bActive ? "#0a6ed1" : "#d9d9d9";

        const oDot = new VBox({ alignItems: "Center" }).addStyleClass("trackingDotWrap");
        oDot.addItem(new Icon({
          src: iCurrent < 0 ? "sap-icon://message-error" : bDone ? "sap-icon://accept" : "sap-icon://circle-task-2",
          color: sColor,
          size: "1.1rem"
        }));
        oDot.addItem(new Text({ text: oStage.label }).addStyleClass(bActive ? "trackingActiveLabel" : "trackingLabel"));
        oRail.addItem(oDot);

        if (iIndex < STAGES.length - 1) {
          const oLine = new VBox().addStyleClass(bDone ? "trackingLineDone" : "trackingLine");
          oRail.addItem(oLine);
        }
      });

      return oRail;
    },

    _currentStageIndex: function (sStatus) {
      switch (sStatus) {
        case "NOT_SCHEDULED": return 0;
        case "SCHEDULED":     return 1;
        case "IN_TRANSIT":    return 2;
        case "DELIVERED":     return 3;
        default:              return -1; // FAILED
      }
    },

    _getActions: function (sStatus) {
      switch (sStatus) {
        case "NOT_SCHEDULED":
          return [{ name: "scheduleDelivery", text: "Schedule", icon: "sap-icon://appointment-2" }];
        case "IN_TRANSIT":
          return [{ name: "markDelivered", text: "Mark Delivered", icon: "sap-icon://accept" }];
        case "FAILED":
          return [{ name: "retryDelivery", text: "Retry", icon: "sap-icon://redo" }];
        default:
          return [];
      }
    },

    _onActionPress: function (oAction, oDelivery, oParent) {
      MessageToast.show(
        `Скоро: ${oAction.name}() → CAP action для заказа ${oParent.orderNo || oDelivery.ID}`
      );
    }
  });
});