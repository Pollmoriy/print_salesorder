sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"printflow/payments/test/integration/pages/PaymentsList.gen",
	"printflow/payments/test/integration/pages/PaymentsObjectPage.gen"
], function (JourneyRunner, PaymentsListGenerated, PaymentsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('printflow/payments') + '/test/flp.html#app-preview',
        pages: {
			onThePaymentsListGenerated: PaymentsListGenerated,
			onThePaymentsObjectPageGenerated: PaymentsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

