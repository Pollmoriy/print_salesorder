sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Panel",
  "sap/m/Title",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/ui/core/Icon",
  "sap/ui/core/library"
], function (Controller, JSONModel, VBox, HBox, Panel, Title, Text, ObjectStatus, Icon, coreLibrary) {
  "use strict";

  const ValueState = coreLibrary.ValueState;

  const ORDER_STATUSES = ["DRAFT", "SUBMITTED", "CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELLED"];
  const PRODUCTION_STATUSES = ["PLANNED", "IN_PROGRESS", "PAUSED", "QUALITY_CHECK", "REWORK", "COMPLETED", "CANCELLED"];

  return Controller.extend("printflow.dashboard.controller.App", {

    onInit: function () {
      this.getView().setModel(new JSONModel({ text: this._getGreeting() }), "greeting");

      const oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        // eslint-disable-next-line no-console
        console.error("Default OData model is not configured — check manifest.json > sap.ui5.models");
        return;
      }
      this._loadAll(oModel);
    },

    _getGreeting: function () {
      const iHour = new Date().getHours();
      if (iHour < 12) return "Good morning";
      if (iHour < 18) return "Good afternoon";
      return "Good evening";
    },

    _loadAll: async function (oModel) {
      try {
        const [aOrders, aProductionOrders, aMaterials] = await Promise.all([
          this._fetchAll(oModel, "/SalesOrders", {
            $select: "ID,orderNo,status,totalAmount,createdAt,requestedDeliveryDate,customer_ID",
            $expand: "customer($select=name)"
          }),
          this._fetchAll(oModel, "/ProductionOrders", {
            $select: "ID,status,plannedEnd,parent_ID",
            $expand: "parent($select=orderNo)"
          }),
          this._fetchAll(oModel, "/Materials", {
            $select: "ID,name,status"
          })
        ]);

        this._renderKpis(aOrders);
        this._renderOrdersChart(aOrders);
        this._renderProductionChart(aProductionOrders);
        this._renderAttention(aOrders, aProductionOrders, aMaterials);
        this._renderRecentOrders(aOrders);
      } catch (oError) {
        // eslint-disable-next-line no-console
        console.error("Failed to load dashboard data:", oError);
      }
    },

    _fetchAll: async function (oModel, sPath, mParams) {
      const oBinding = oModel.bindList(sPath, null, [], [], mParams);
      const aContexts = await oBinding.requestContexts(0, 1000);
      return aContexts.map((oCtx) => oCtx.getObject());
    },

    // ---------------- KPI cards ----------------
    _renderKpis: function (aOrders) {
      const sToday = new Date().toISOString().slice(0, 10);
      const aTodayOrders = aOrders.filter((o) => o.createdAt && o.createdAt.slice(0, 10) === sToday);
      const fRevenueToday = aTodayOrders.reduce((fSum, o) => fSum + (Number(o.totalAmount) || 0), 0);
      const iInProduction = aOrders.filter((o) => o.status === "IN_PRODUCTION").length;
      const iReadyForPickup = aOrders.filter((o) => o.status === "READY").length;

      const oContainer = this.byId("kpiContainer");
      oContainer.destroyItems();
      oContainer.addItem(this._buildKpiCard("Orders Today", String(aTodayOrders.length), "kpiOrders"));
      oContainer.addItem(this._buildKpiCard("Revenue", `€${fRevenueToday.toFixed(2)}`, "kpiRevenue"));
      oContainer.addItem(this._buildKpiCard("In Production", String(iInProduction), "kpiProduction"));
      oContainer.addItem(this._buildKpiCard("Ready for Pickup", String(iReadyForPickup), "kpiReady"));
    },

    _buildKpiCard: function (sLabel, sValue, sColorClass) {
      const oCard = new Panel().addStyleClass("kpiCard");
      if (sColorClass) oCard.addStyleClass(sColorClass);
      oCard.addContent(new Text({ text: sLabel }).addStyleClass("kpiLabel"));
      oCard.addContent(new Text({ text: sValue }).addStyleClass("kpiValue"));
      return oCard;
    },

    // ---------------- Orders by Status (bar chart) ----------------
    _renderOrdersChart: function (aOrders) {
      const oCounts = {};
      ORDER_STATUSES.forEach((s) => { oCounts[s] = 0; });
      aOrders.forEach((o) => { if (oCounts[o.status] !== undefined) oCounts[o.status]++; });

      const oContainer = this.byId("ordersChartContainer");
      oContainer.destroyItems();
      oContainer.addItem(new Title({ text: "Orders by Status", level: "H4" }).addStyleClass("dashPanelTitle"));

      const iMax = Math.max(1, ...Object.values(oCounts));
      ORDER_STATUSES.forEach((sStatus) => {
        oContainer.addItem(this._buildBarRow(sStatus, oCounts[sStatus], iMax, "status"));
      });
    },

    // ---------------- Production workload (bar chart) ----------------
    _renderProductionChart: function (aProductionOrders) {
      const oCounts = {};
      PRODUCTION_STATUSES.forEach((s) => { oCounts[s] = 0; });
      aProductionOrders.forEach((p) => { if (oCounts[p.status] !== undefined) oCounts[p.status]++; });

      const oContainer = this.byId("productionChartContainer");
      oContainer.destroyItems();
      oContainer.addItem(new Title({ text: "Production Workload", level: "H4" }).addStyleClass("dashPanelTitle"));

      const iMax = Math.max(1, ...Object.values(oCounts));
      PRODUCTION_STATUSES.forEach((sStatus) => {
        oContainer.addItem(this._buildBarRow(sStatus, oCounts[sStatus], iMax, "prod"));
      });
    },

    _toPascalCase: function (sStatus) {
      return sStatus.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    },

    _buildBarRow: function (sLabel, iValue, iMax, sPrefix) {
      const oRow = new HBox({ alignItems: "Center" }).addStyleClass("barRow");
      oRow.addItem(new Text({ text: sLabel }).addStyleClass("barLabel"));

      const oTrack = new HBox().addStyleClass("barTrack");
      const oFill = new VBox().addStyleClass("barFill " + sPrefix + this._toPascalCase(sLabel));
      oTrack.addItem(oFill);

      const oRowWithBar = new HBox({ alignItems: "Center", justifyContent: "SpaceBetween" }).addStyleClass("barRowInner");
      oRowWithBar.addItem(oTrack);
      oRowWithBar.addItem(new Text({ text: String(iValue) }).addStyleClass("barValue"));

      oRow.addItem(oRowWithBar);

      oFill.addEventDelegate({
        onAfterRendering: function () {
          const iPercent = Math.round((iValue / iMax) * 100);
          oFill.$().css("width", iPercent + "%");
        }
      });

      return oRow;
    },

    // ---------------- Attention Required ----------------
    _renderAttention: function (aOrders, aProductionOrders, aMaterials) {
      const sToday = new Date().toISOString().slice(0, 10);
      const oNow = new Date();

      const aOverdueOrders = aOrders.filter((o) =>
        o.requestedDeliveryDate &&
        o.requestedDeliveryDate < sToday &&
        o.status !== "DELIVERED" &&
        o.status !== "CANCELLED"
      );

      const aCriticalMaterials = aMaterials.filter((m) => m.status === "CRITICAL");

      const aDelayedProductions = aProductionOrders.filter((p) =>
        p.plannedEnd &&
        new Date(p.plannedEnd) < oNow &&
        p.status !== "COMPLETED" &&
        p.status !== "CANCELLED"
      );

      const oContainer = this.byId("attentionContainer");
      oContainer.destroyItems();
      oContainer.addItem(new Title({ text: "Attention Required", level: "H4" }).addStyleClass("dashPanelTitle"));

      if (!aOverdueOrders.length && !aCriticalMaterials.length && !aDelayedProductions.length) {
        oContainer.addItem(new Text({ text: "Nothing needs attention right now." }).addStyleClass("attentionEmpty"));
        return;
      }

      if (aOverdueOrders.length) {
        oContainer.addItem(this._buildAttentionRow("sap-icon://alert", "#bb0000", `${aOverdueOrders.length} overdue orders`));
      }
      if (aCriticalMaterials.length) {
        oContainer.addItem(this._buildAttentionRow("sap-icon://warning", "#e9730c", `${aCriticalMaterials.length} critical materials`));
      }
      if (aDelayedProductions.length) {
        oContainer.addItem(this._buildAttentionRow("sap-icon://pending", "#e9730c", `${aDelayedProductions.length} delayed productions`));
      }
    },

    _buildAttentionRow: function (sIcon, sColor, sText) {
      const oRow = new HBox({ alignItems: "Center" }).addStyleClass("attentionRow");
      oRow.addItem(new Icon({ src: sIcon, color: sColor, size: "1.1rem" }).addStyleClass("attentionIcon"));
      oRow.addItem(new Text({ text: sText }));
      return oRow;
    },

    // ---------------- Recent Orders ----------------
    _renderRecentOrders: function (aOrders) {
      const aSorted = [...aOrders].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      const aRecent = aSorted.slice(0, 5);

      const oContainer = this.byId("recentOrdersContainer");
      oContainer.destroyItems();
      oContainer.addItem(new Title({ text: "Recent Orders", level: "H4" }).addStyleClass("dashPanelTitle"));

      if (!aRecent.length) {
        oContainer.addItem(new Text({ text: "No orders yet." }).addStyleClass("attentionEmpty"));
        return;
      }

      aRecent.forEach((oOrder) => {
        const oRow = new HBox({ alignItems: "Center", justifyContent: "SpaceBetween" }).addStyleClass("recentOrderRow");
        const oLeft = new VBox();
        oLeft.addItem(new Text({ text: oOrder.orderNo || "—" }).addStyleClass("recentOrderNo"));
        oLeft.addItem(new Text({ text: (oOrder.customer && oOrder.customer.name) || "—" }).addStyleClass("recentOrderCustomer"));
        oRow.addItem(oLeft);

        const oRight = new VBox({ alignItems: "End" });
        oRight.addItem(new Text({ text: `€${(Number(oOrder.totalAmount) || 0).toFixed(2)}` }));
        oRight.addItem(new ObjectStatus({ text: oOrder.status }));
        oRow.addItem(oRight);

        oContainer.addItem(oRow);
      });
    }
  });
});