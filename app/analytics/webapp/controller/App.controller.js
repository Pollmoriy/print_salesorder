sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Panel",
  "sap/m/Title",
  "sap/m/Text",
  "sap/ui/core/Icon"
], function (Controller, VBox, HBox, Panel, Title, Text, Icon) {
  "use strict";

  const MATERIAL_STATUSES = ["AVAILABLE", "LOW_STOCK", "CRITICAL", "OUT_OF_STOCK"];

  return Controller.extend("printflow.analytics.controller.App", {

    onInit: function () {
      const oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        // eslint-disable-next-line no-console
        console.error("Default OData model is not configured — check manifest.json > sap.ui5.models");
        return;
      }
      this._loadAll(oModel);
    },

    _loadAll: async function (oModel) {
      try {
        const [aOrders, aItems, aProductionOrders, aMaterials] = await Promise.all([
          this._fetchAll(oModel, "/SalesOrders", {
            $select: "ID,orderNo,status,totalAmount,createdAt"
          }),
          this._fetchAll(oModel, "/OrderItems", {
            $select: "ID,quantity,lineTotal,product_ID",
            $expand: "product($select=name)"
          }),
          this._fetchAll(oModel, "/ProductionOrders", {
            $select: "ID,status,plannedStart,plannedEnd,actualStart,actualEnd"
          }),
          this._fetchAll(oModel, "/Materials", {
            $select: "ID,name,status"
          })
        ]);

        this._renderSalesKpis(aOrders);
        this._renderRevenueChart(aOrders);
        this._renderTopProducts(aItems);
        this._renderProductionAnalytics(aProductionOrders);
        this._renderInventoryAnalytics(aMaterials);
      } catch (oError) {
        // eslint-disable-next-line no-console
        console.error("Failed to load analytics data:", oError);
      }
    },

    _fetchAll: async function (oModel, sPath, mParams) {
      const oBinding = oModel.bindList(sPath, null, [], [], mParams);
      const aContexts = await oBinding.requestContexts(0, 1000);
      return aContexts.map((oCtx) => oCtx.getObject());
    },

    _toClassSuffix: function (sLabel) {
      return sLabel.toLowerCase()
        .split(/[_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("")
        .replace(/[^A-Za-z0-9]/g, "");
    },

    _buildKpiCard: function (sLabel, sValue, sColorClass, sIcon) {
      const oCard = new Panel().addStyleClass("kpiCard");
      if (sColorClass) oCard.addStyleClass(sColorClass);
      if (sIcon) {
        oCard.addContent(new Icon({ src: sIcon, size: "1.5rem" }).addStyleClass("kpiIcon"));
      }
      oCard.addContent(new Text({ text: sLabel }).addStyleClass("kpiLabel"));
      oCard.addContent(new Text({ text: sValue }).addStyleClass("kpiValue"));
      return oCard;
    },

    _buildBarRow: function (sLabel, iValue, iMax, sPrefix, sDisplayValue) {
      const oRow = new HBox({ alignItems: "Center" }).addStyleClass("barRow");
      oRow.addItem(new Text({ text: sLabel }).addStyleClass("barLabel"));

      const oTrack = new HBox().addStyleClass("barTrack");
      const oFill = new VBox().addStyleClass("barFill " + sPrefix + this._toClassSuffix(sLabel));
      oTrack.addItem(oFill);

      const oRowWithBar = new HBox({ alignItems: "Center", justifyContent: "SpaceBetween" }).addStyleClass("barRowInner");
      oRowWithBar.addItem(oTrack);
      oRowWithBar.addItem(new Text({ text: sDisplayValue !== undefined ? sDisplayValue : String(iValue) }).addStyleClass("barValue"));

      oRow.addItem(oRowWithBar);

      oFill.addEventDelegate({
        onAfterRendering: function () {
          const iPercent = iMax > 0 ? Math.round((iValue / iMax) * 100) : 0;
          oFill.$().css("width", iPercent + "%");
        }
      });

      return oRow;
    },

    // ---------------- Sales Analytics ----------------
    _renderSalesKpis: function (aOrders) {
      const aValidOrders = aOrders.filter((o) => o.status !== "CANCELLED");
      const fRevenue = aValidOrders.reduce((fSum, o) => fSum + (Number(o.totalAmount) || 0), 0);
      const iOrderCount = aValidOrders.length;
      const fAvgOrderValue = iOrderCount > 0 ? fRevenue / iOrderCount : 0;

      const oContainer = this.byId("salesKpiContainer");
      oContainer.destroyItems();
      oContainer.addItem(this._buildKpiCard("Revenue", `€${fRevenue.toFixed(2)}`, "kpiRevenue", "sap-icon://money-bills"));
      oContainer.addItem(this._buildKpiCard("Orders", String(iOrderCount), "kpiOrders", "sap-icon://sales-order"));
      oContainer.addItem(this._buildKpiCard("Average Order Value", `€${fAvgOrderValue.toFixed(2)}`, "kpiProduction", "sap-icon://kpi-managing-my-area"));
    },

    _renderRevenueChart: function (aOrders) {
      const oByMonth = {};
      aOrders
        .filter((o) => o.status !== "CANCELLED" && o.createdAt)
        .forEach((o) => {
          const sMonth = o.createdAt.slice(0, 7);
          oByMonth[sMonth] = (oByMonth[sMonth] || 0) + (Number(o.totalAmount) || 0);
        });

      const aMonths = Object.keys(oByMonth).sort();
      const fMax = Math.max(1, ...Object.values(oByMonth));

      const oContainer = this.byId("revenueChartContainer");
      oContainer.destroyItems();
      oContainer.addItem(new Title({ text: "Revenue over Time", level: "H4" }).addStyleClass("dashPanelTitle"));

      if (!aMonths.length) {
        oContainer.addItem(new Text({ text: "No revenue data yet." }).addStyleClass("attentionEmpty"));
        return;
      }

      aMonths.forEach((sMonth) => {
        const fValue = oByMonth[sMonth];
        oContainer.addItem(this._buildBarRow(sMonth, fValue, fMax, "revenue", `€${fValue.toFixed(0)}`));
      });
    },

    // ---------------- Product Analytics ----------------
    _renderTopProducts: function (aItems) {
      const oByProduct = {};
      aItems.forEach((oItem) => {
        const sName = (oItem.product && oItem.product.name) || "Unknown";
        oByProduct[sName] = (oByProduct[sName] || 0) + (Number(oItem.quantity) || 0);
      });

      const aTop = Object.entries(oByProduct)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const oContainer = this.byId("topProductsContainer");
      oContainer.destroyItems();
      oContainer.addItem(new Title({ text: "Top Products (by quantity ordered)", level: "H4" }).addStyleClass("dashPanelTitle"));

      if (!aTop.length) {
        oContainer.addItem(new Text({ text: "No order items yet." }).addStyleClass("attentionEmpty"));
        return;
      }

      const iMax = aTop[0][1];
      aTop.forEach(([sName, iQty]) => {
        oContainer.addItem(this._buildBarRow(sName, iQty, iMax, "product"));
      });
    },

    // ---------------- Production Analytics ----------------
    _renderProductionAnalytics: function (aProductionOrders) {
      const oNow = new Date();
      const iCompleted = aProductionOrders.filter((p) => p.status === "COMPLETED").length;
      const iInProduction = aProductionOrders.filter((p) => p.status === "IN_PROGRESS").length;
      const iDelayed = aProductionOrders.filter((p) =>
        p.plannedEnd &&
        new Date(p.plannedEnd) < oNow &&
        p.status !== "COMPLETED" &&
        p.status !== "CANCELLED"
      ).length;

      const aCompletedWithTimes = aProductionOrders.filter((p) =>
        p.status === "COMPLETED" && p.actualStart && p.actualEnd
      );
      let sAvgTime = "—";
      if (aCompletedWithTimes.length) {
        const fAvgMs = aCompletedWithTimes.reduce((fSum, p) =>
          fSum + (new Date(p.actualEnd) - new Date(p.actualStart)), 0
        ) / aCompletedWithTimes.length;
        const fAvgHours = fAvgMs / (1000 * 60 * 60);
        sAvgTime = fAvgHours >= 24
          ? `${(fAvgHours / 24).toFixed(1)} days`
          : `${fAvgHours.toFixed(1)} hours`;
      }

      const oContainer = this.byId("productionKpiContainer");
      oContainer.destroyItems();
     oContainer.addItem(this._buildKpiCard("Completed", String(iCompleted), "kpiReady", "sap-icon://complete"));
      oContainer.addItem(this._buildKpiCard("In Production", String(iInProduction), "kpiProduction", "sap-icon://factory"));
      oContainer.addItem(this._buildKpiCard("Delayed", String(iDelayed), "kpiDelayed", "sap-icon://alert"));
      oContainer.addItem(this._buildKpiCard("Avg. Production Time", sAvgTime, "kpiOrders", "sap-icon://time-entry-request"));
    },

    // ---------------- Inventory Analytics ----------------
    _renderInventoryAnalytics: function (aMaterials) {
      const oCounts = {};
      MATERIAL_STATUSES.forEach((s) => { oCounts[s] = 0; });
      aMaterials.forEach((m) => { if (oCounts[m.status] !== undefined) oCounts[m.status]++; });

      const oContainer = this.byId("inventoryKpiContainer");
      oContainer.destroyItems();
      oContainer.addItem(this._buildKpiCard("Available", String(oCounts.AVAILABLE), "kpiReady", "sap-icon://accept"));
      oContainer.addItem(this._buildKpiCard("Low Stock", String(oCounts.LOW_STOCK), "kpiSubmitted", "sap-icon://warning"));
      oContainer.addItem(this._buildKpiCard("Critical", String(oCounts.CRITICAL), "kpiProduction", "sap-icon://alert"));
      oContainer.addItem(this._buildKpiCard("Out of Stock", String(oCounts.OUT_OF_STOCK), "kpiDelayed", "sap-icon://cancel"));
    }
  });
});