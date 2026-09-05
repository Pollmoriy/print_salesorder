sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"printflow/warehouses/test/integration/pages/WarehousesList.gen",
	"printflow/warehouses/test/integration/pages/WarehousesObjectPage.gen"
], function (JourneyRunner, WarehousesListGenerated, WarehousesObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('printflow/warehouses') + '/test/flp.html#app-preview',
        pages: {
			onTheWarehousesListGenerated: WarehousesListGenerated,
			onTheWarehousesObjectPageGenerated: WarehousesObjectPageGenerated
        },
        async: true
    });

    return runner;
});

