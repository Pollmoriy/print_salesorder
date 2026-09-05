sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/VBox",
  "sap/m/Panel",
  "sap/m/Title",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/m/Toolbar",
  "sap/m/Button",
  "sap/m/MessageToast",
  "sap/ui/core/library"
], function (Controller, VBox, Panel, Title, Text, ObjectStatus, Toolbar, Button, MessageToast, coreLibrary) {
  "use strict";

  const ValueState = coreLibrary.ValueState;

  const COLUMNS = [
    { key: "PLANNED",       label: "PLANNED",       statuses: ["PLANNED"] },
    { key: "IN_PROGRESS",   label: "IN PROGRESS",   statuses: ["IN_PROGRESS", "PAUSED"] },
    { key: "QUALITY_CHECK", label: "QUALITY CHECK", statuses: ["QUALITY_CHECK", "REWORK"] },
    { key: "COMPLETED",     label: "COMPLETED",     statuses: ["COMPLETED"] }
  ];

  const ACTIONS_BY_STATUS = {
    PLANNED:       [{ name: "startProduction",   text: "Start",         icon: "sap-icon://media-play" }],
    IN_PROGRESS:   [{ name: "pauseProduction",   text: "Pause",         icon: "sap-icon://media-pause" },
                     { name: "completeQualityCheck", text: "Quality Check", icon: "sap-icon://inspection" },
                     { name: "reportProductionIssue", text: "Report Issue", icon: "sap-icon://alert" }],
    PAUSED:        [{ name: "resumeProduction",  text: "Resume",        icon: "sap-icon://media-forward" },
                     { name: "reportProductionIssue", text: "Report Issue", icon: "sap-icon://alert" }],
    QUALITY_CHECK: [{ name: "completeProduction", text: "Complete",     icon: "sap-icon://complete" },
                     { name: "startRework",       text: "Rework",       icon: "sap-icon://undo" }],
    REWORK:        [{ name: "startProduction",   text: "Restart",      icon: "sap-icon://media-play" }],
    COMPLETED:     []
  };

  const STATUS_TO_VALUESTATE = {
    PLANNED: ValueState.None,
    IN_PROGRESS: ValueState.Warning,
    PAUSED: ValueState.Warning,
    QUALITY_CHECK: ValueState.Information,
    REWORK: ValueState.Error,
    COMPLETED: ValueState.Success
  };

  return Controller.extend("printflow.productionboard.controller.App", {

        onInit: function () {
      const oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        // eslint-disable-next-line no-console
        console.error("Default OData model is not configured — check manifest.json > sap.ui5.models");
        return;
      }
      this._loadBoard(oModel);
    },

    _loadBoard: async function (oModel) {
      const oBinding = oModel.bindList("/ProductionOrders", null, [], [], {
        $expand: "parent($select=orderNo,urgencyLevel,requestedDeliveryDate;$expand=items($select=quantity;$expand=product($select=name)))"
      });

      try {
        const aContexts = await oBinding.requestContexts(0, 1000);
        const aOrders = aContexts.map((oCtx) => oCtx.getObject());
        this._renderBoard(aOrders);
      } catch (oError) {
        // eslint-disable-next-line no-console
        console.error("Failed to load ProductionOrders:", oError);
      }
    },

    _renderBoard: function (aOrders) {
      const oContainer = this.byId("boardContainer");
      oContainer.destroyItems();

      COLUMNS.forEach((oColumnDef) => {
        const aColumnOrders = aOrders.filter((o) => oColumnDef.statuses.includes(o.status));
        oContainer.addItem(this._buildColumn(oColumnDef, aColumnOrders));
      });
    },

    _buildColumn: function (oColumnDef, aColumnOrders) {
      const oColumn = new VBox({ class: "boardColumn" }).addStyleClass("boardColumn");

      oColumn.addItem(new Title({
        text: `${oColumnDef.label} (${aColumnOrders.length})`,
        level: "H4"
      }).addStyleClass("boardColumnTitle"));

      if (!aColumnOrders.length) {
        oColumn.addItem(new Text({ text: "—" }).addStyleClass("boardEmptyText"));
      }

      aColumnOrders.forEach((oOrder) => {
        oColumn.addItem(this._buildCard(oOrder));
      });

      return oColumn;
    },

    _buildCard: function (oOrder) {
      const oParent = oOrder.parent || {};
      const oFirstItem = (oParent.items && oParent.items[0]) || {};
      const sProductLine = oFirstItem.product
        ? `${oFirstItem.quantity} × ${oFirstItem.product.name}`
        : "—";

      const oCard = new Panel({ class: "boardCard" }).addStyleClass("boardCard");

      oCard.addContent(new Text({ text: oParent.orderNo || "—" }).addStyleClass("boardCardOrderNo"));
      oCard.addContent(new Text({ text: sProductLine }));
      oCard.addContent(new ObjectStatus({
        text: oParent.urgencyLevel || "STANDARD",
        state: oParent.urgencyLevel === "URGENT" ? ValueState.Error
             : oParent.urgencyLevel === "EXPRESS" ? ValueState.Warning
             : ValueState.None
      }));
      oCard.addContent(new Text({
        text: oParent.requestedDeliveryDate
          ? `Deadline: ${oParent.requestedDeliveryDate}`
          : "Deadline: —"
      }));
        if (oOrder.status === "PAUSED" || oOrder.status === "REWORK") {
            oCard.addContent(new ObjectStatus({
            text: oOrder.status === "PAUSED" ? "Paused" : "Needs Rework",
            state: STATUS_TO_VALUESTATE[oOrder.status]
        }));
      }

      const aActions = ACTIONS_BY_STATUS[oOrder.status] || [];
      if (aActions.length) {
        const oToolbar = new Toolbar();
        aActions.forEach((oAction) => {
          oToolbar.addContent(new Button({
            text: oAction.text,
            icon: oAction.icon,
            type: "Transparent",
            press: () => this._onActionPress(oAction, oOrder, oParent)
          }));
        });
        oCard.addContent(oToolbar);
      }

      return oCard;
    },

    _onActionPress: function (oAction, oOrder, oParent) {
      MessageToast.show(
        `Скоро: ${oAction.name}() → CAP action для заказа ${oParent.orderNo || oOrder.ID}`
      );
    }
  });
});