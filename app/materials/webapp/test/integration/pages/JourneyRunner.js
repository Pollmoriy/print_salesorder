sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"printflow/materials/test/integration/pages/MaterialsList.gen",
	"printflow/materials/test/integration/pages/MaterialsObjectPage.gen"
], function (JourneyRunner, MaterialsListGenerated, MaterialsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('printflow/materials') + '/test/flp.html#app-preview',
        pages: {
			onTheMaterialsListGenerated: MaterialsListGenerated,
			onTheMaterialsObjectPageGenerated: MaterialsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

