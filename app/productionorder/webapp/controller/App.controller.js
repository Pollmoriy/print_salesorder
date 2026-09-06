sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/StandardListItem",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Title",
  "sap/m/Text",
  "sap/m/Label",
  "sap/m/ObjectStatus",
  "sap/m/Toolbar",
  "sap/m/Button",
  "sap/m/MessageToast",
  "sap/ui/core/Icon",
  "sap/ui/layout/form/SimpleForm",
  "sap/ui/core/library"
], function (Controller, StandardListItem, VBox, HBox, Title, Text, Label, ObjectStatus, Toolbar, Button, MessageToast, Icon, SimpleForm, coreLibrary) {
  "use strict";

  const ValueState = coreLibrary.ValueState;

  const STAGES = [
    { key: "RECEIVED",      label: "Order received" },
    { key: "PREPRESS",      label: "Prepress" },
    { key: "PRINTING",      label: "Printing" },
    { key: "FINISHING",     label: "Finishing" },
    { key: "QUALITY_CHECK", label: "Quality Check" },
    { key: "COMPLETED",     label: "Completed" }
  ];

  const ACTIONS_BY_STATUS = {
    PLANNED:       [{ name: "startProduction",   text: "Start",         icon: "sap-icon://media-play" }],
    IN_PROGRESS:   [{ name: "pauseProduction",   text: "Pause",         icon: "sap-icon://media-pause" },
                     { name: "completeQualityCheck", text: "Send to QC", icon: "sap-icon://inspection" },
                     { name: "reportProductionIssue", text: "Report Issue", icon: "sap-icon://alert" }],
    PAUSED:        [{ name: "resumeProduction",  text: "Resume",        icon: "sap-icon://media-forward" },
                     { name: "reportProductionIssue", text: "Report Issue", icon: "sap-icon://alert" }],
    QUALITY_CHECK: [{ name: "completeProduction", text: "Complete",     icon: "sap-icon://complete" },
                     { name: "startRework",       text: "Rework",       icon: "sap-icon://undo" }],
    REWORK:        [{ name: "startProduction",   text: "Restart",      icon: "sap-icon://media-play" }],
    COMPLETED:     [],
    CANCELLED:     []
  };

  const STATUS_TO_VALUESTATE = {
    PLANNED: ValueState.None,
    IN_PROGRESS: ValueState.Warning,
    PAUSED: ValueState.Warning,
    QUALITY_CHECK: ValueState.Information,
    REWORK: ValueState.Error,
    COMPLETED: ValueState.Success,
    CANCELLED: ValueState.Error
  };

  return Controller.extend("printflow.productionorder.controller.App", {

    onInit: function () {
      const oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        // eslint-disable-next-line no-console
        console.error("Default OData model is not configured — check manifest.json > sap.ui5.models");
        return;
      }
      this._oModel = oModel;
      this._loadList();
    },

    _loadList: async function () {
      const oBinding = this._oModel.bindList("/ProductionOrders", null, [], [], {
        $expand: "parent($select=orderNo)"
      });

      try {
        const aContexts = await oBinding.requestContexts(0, 1000);
        this._aOrders = aContexts.map((oCtx) => oCtx.getObject());
        this._renderList();
      } catch (oError) {
        // eslint-disable-next-line no-console
        console.error("Failed to load ProductionOrders:", oError);
      }
    },

    _renderList: function () {
      const oList = this.byId("orderList");
      oList.destroyItems();

      this._aOrders.forEach((oOrder, iIndex) => {
        const oParent = oOrder.parent || {};
        oList.addItem(new StandardListItem({
          title: oParent.orderNo || oOrder.ID,
          description: oOrder.status,
          type: "Active",
          customData: [new sap.ui.core.CustomData({ key: "index", value: iIndex })]
        }));
      });

      if (this._aOrders.length) {
        oList.setSelectedItem(oList.getItems()[0]);
        this._showDetail(this._aOrders[0]);
      }
    },

    onOrderSelect: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const iIndex = parseInt(oItem.getCustomData()[0].getValue(), 10);
      this._showDetail(this._aOrders[iIndex]);
    },

    _showDetail: function (oOrder) {
      const oContainer = this.byId("detailContainer");
      oContainer.destroyItems();

      const oParent = oOrder.parent || {};

      // --- General ---
      oContainer.addItem(new Title({ text: "General", level: "H4" }).addStyleClass("sectionTitle"));
      const oForm = new SimpleForm({ layout: "ResponsiveGridLayout" });
      oForm.addContent(new Label({ text: "Order" }));
      oForm.addContent(new Text({ text: oParent.orderNo || oOrder.parent_ID || "—" }));
      oForm.addContent(new Label({ text: "Production Status" }));
      oForm.addContent(new ObjectStatus({ text: oOrder.status, state: STATUS_TO_VALUESTATE[oOrder.status] || ValueState.None }));
      oForm.addContent(new Label({ text: "Planned Start" }));
      oForm.addContent(new Text({ text: oOrder.plannedStart || "—" }));
      oForm.addContent(new Label({ text: "Planned End" }));
      oForm.addContent(new Text({ text: oOrder.plannedEnd || "—" }));
      oForm.addContent(new Label({ text: "Actual Start" }));
      oForm.addContent(new Text({ text: oOrder.actualStart || "—" }));
      oForm.addContent(new Label({ text: "Actual End" }));
      oForm.addContent(new Text({ text: oOrder.actualEnd || "—" }));
      oForm.addContent(new Label({ text: "Estimated Completion" }));
      oForm.addContent(new Text({ text: oOrder.estimatedCompletion || "—" }));
      oContainer.addItem(oForm);

      // --- Production Timeline ---
      oContainer.addItem(new Title({ text: "Production Timeline", level: "H4" }).addStyleClass("sectionTitle"));
      oContainer.addItem(this._buildTimeline(oOrder.status));

      // --- Actions ---
      oContainer.addItem(new Title({ text: "Actions", level: "H4" }).addStyleClass("sectionTitle"));
      const aActions = ACTIONS_BY_STATUS[oOrder.status] || [];
      const oToolbar = new Toolbar();
      if (aActions.length) {
        aActions.forEach((oAction) => {
          oToolbar.addContent(new Button({
            text: oAction.text,
            icon: oAction.icon,
            press: () => this._onActionPress(oAction, oOrder, oParent)
          }));
        });
      } else {
        oToolbar.addContent(new Text({ text: "No actions available for this status." }));
      }
      oContainer.addItem(oToolbar);
    },

    _buildTimeline: function (sStatus) {
      const iCurrent = this._currentStageIndex(sStatus);
      const oLayout = new HBox({ wrap: "Wrap" }).addStyleClass("prodTimeline");

      STAGES.forEach((oStage, iIndex) => {
        const sIcon = iCurrent < 0 ? "sap-icon://message-error"
          : iIndex < iCurrent ? "sap-icon://accept"
          : iIndex === iCurrent ? "sap-icon://future"
          : "sap-icon://circle-task-2";
        const sColor = iCurrent < 0 ? "#bb0000"
          : iIndex < iCurrent ? "#107e3e"
          : iIndex === iCurrent ? "#0a6ed1"
          : "#89919a";

        const oStageBox = new VBox({ alignItems: "Center" }).addStyleClass("prodTimelineStage");
        oStageBox.addItem(new Icon({ src: sIcon, color: sColor, size: "1.5rem" }));
        oStageBox.addItem(new Text({ text: oStage.label })
          .addStyleClass(iIndex === iCurrent ? "prodTimelineCurrentText" : ""));
        oLayout.addItem(oStageBox);

        if (iIndex < STAGES.length - 1) {
          oLayout.addItem(new VBox().addStyleClass("prodTimelineConnector"));
        }
      });

      return oLayout;
    },

    _currentStageIndex: function (sStatus) {
      switch (sStatus) {
        case "PLANNED":       return 0;
        case "IN_PROGRESS":
        case "PAUSED":        return 3;
        case "QUALITY_CHECK":
        case "REWORK":        return 4;
        case "COMPLETED":     return 5;
        default:              return -1;
      }
    },

    _onActionPress: function (oAction, oOrder, oParent) {
      MessageToast.show(
        `Скоро: ${oAction.name}() → CAP action для заказа ${oParent.orderNo || oOrder.ID}`
      );
    }
  });
});