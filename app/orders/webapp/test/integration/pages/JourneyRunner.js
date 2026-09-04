sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"printflow/orders/test/integration/pages/SalesOrdersList.gen",
	"printflow/orders/test/integration/pages/SalesOrdersObjectPage.gen"
], function (JourneyRunner, SalesOrdersListGenerated, SalesOrdersObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('printflow/orders') + '/test/flp.html#app-preview',
        pages: {
			onTheSalesOrdersListGenerated: SalesOrdersListGenerated,
			onTheSalesOrdersObjectPageGenerated: SalesOrdersObjectPageGenerated
        },
        async: true
    });

    return runner;
});

