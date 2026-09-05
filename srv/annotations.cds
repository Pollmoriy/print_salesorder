using SalesOrderService as service from './service';

// ---------------------------------------------------------------------------
// SalesOrders — List Report columns, filters, labels, semantic status colors
// (Stage 2 / Phase 2.2 — plan items 8-9: human-readable fields + semantic UI)
// ---------------------------------------------------------------------------

annotate service.SalesOrders with {
  orderNo               @title: 'Order No';
  customer              @title: 'Customer';
  status                @title: 'Status';
  urgencyLevel          @title: 'Urgency';
  requestedDeliveryDate @title: 'Requested Delivery Date';
  totalAmount           @title: 'Total Amount';
  paymentStatus         @title: 'Payment Status';
  discountPercent       @title: 'Discount (%)';
  createdAt             @title: 'Order Date';
};

annotate service.SalesOrders with {
  balanceDue @title: 'Balance Due';
  createdBy  @title: 'Created By';
  modifiedAt @title: 'Last Changed On';
  modifiedBy @title: 'Last Changed By';
};

// Show the customer's name instead of the raw foreign-key UUID,
// everywhere this association is displayed (List Report, Object Page,
// Value Help result column)
annotate service.SalesOrders with {
  customer @Common: {
    Text            : customer.name,
    TextArrangement : #TextOnly,
  };
};

annotate service.SalesOrders with @(
  UI: {
    // List Report table columns
    LineItem: [
      { Value: orderNo,               Label: 'Order No' },
      { Value: customer_ID,           Label: 'Customer' },
      { Value: status,                Label: 'Status',         Criticality: statusCriticality },
      { Value: urgencyLevel,          Label: 'Urgency',        Criticality: urgencyCriticality },
      { Value: createdAt,             Label: 'Order Date' },
      { Value: requestedDeliveryDate, Label: 'Delivery Date' },
      { Value: totalAmount,           Label: 'Total' },
      { Value: paymentStatus,         Label: 'Payment Status', Criticality: paymentCriticality },
    ],

    // Object Page — General Information section
    FieldGroup #GeneralInfo: {
      Data: [
        { Value: customer_ID },
        { Value: createdAt },
        { Value: urgencyLevel,          Criticality: urgencyCriticality },
        { Value: requestedDeliveryDate },
        { Value: status,                Criticality: statusCriticality },
        { Value: paymentStatus,         Criticality: paymentCriticality },
      ],
    },

    FieldGroup #OrderSummary: {
      Data: [
        { Value: totalAmount,     Label: 'Total' },
        { Value: discountPercent, Label: 'Discount (%)' },
        { Value: paidAmount,      Label: 'Paid Amount' },
        { Value: balanceDue,      Label: 'Balance Due',    Criticality: paymentCriticality },
        { Value: paymentStatus,   Label: 'Payment Status', Criticality: paymentCriticality },
      ],
    },

    FieldGroup #History: {
      Data: [
        { Value: createdAt,  Label: 'Created On' },
        { Value: createdBy,  Label: 'Created By' },
        { Value: modifiedAt, Label: 'Last Changed On' },
        { Value: modifiedBy, Label: 'Last Changed By' },
      ],
    },

    // Object Page sections — General Information + embedded tables for
    // the SalesOrders compositions (Items / Production / Payments / Delivery)
    Facets: [
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'SummaryFacet',
        Label : 'Summary',
        Target: '@UI.FieldGroup#OrderSummary',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'GeneralInfoFacet',
        Label : 'General Information',
        Target: '@UI.FieldGroup#GeneralInfo',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'ItemsFacet',
        Label : 'Order Items',
        Target: 'items/@UI.LineItem',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'ProductionFacet',
        Label : 'Production',
        Target: 'productionOrders/@UI.LineItem',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'PaymentsFacet',
        Label : 'Payments',
        Target: 'payments/@UI.LineItem',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'DeliveryFacet',
        Label : 'Delivery',
        Target: 'deliveries/@UI.LineItem',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'HistoryFacet',
        Label : 'History',
        Target: '@UI.FieldGroup#History',
      },
    ],

    // Filter bar — the 5 required filters (plan item 10) + payment status
    SelectionFields: [
      status,
      customer_ID,
      createdAt,
      urgencyLevel,
      paymentStatus,
    ],
  }
);

// ---------------------------------------------------------------------------
// OrderItems — embedded table in the "Order Items" Object Page section
// ---------------------------------------------------------------------------

annotate service.OrderItems with {
  product          @title: 'Product';
  quantity         @title: 'Quantity';
  unitPrice        @title: 'Unit Price';
  finishingOptions @title: 'Finishing';
  lineTotal        @title: 'Line Total';
};

// Value Help for Product, same pattern as Customer on SalesOrders,
// and show the product name instead of the raw UUID in the Items table
annotate service.OrderItems with {
  product @Common: {
    Text            : product.name,
    TextArrangement : #TextOnly,
    ValueList       : {
      $Type          : 'Common.ValueListType',
      CollectionPath : 'Products',
      Parameters: [
        { $Type: 'Common.ValueListParameterInOut',      LocalDataProperty: product_ID, ValueListProperty: 'ID' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'code' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'unit' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'basePrice' },
      ],
    },
  };
};

annotate service.OrderItems with @(
  UI.LineItem: [
    { Value: product_ID,       Label: 'Product' },
    { Value: quantity,         Label: 'Quantity' },
    { Value: unitPrice,        Label: 'Unit Price' },
    { Value: finishingOptions, Label: 'Finishing' },
    { Value: lineTotal,        Label: 'Line Total' },
  ]
);

// ---------------------------------------------------------------------------
// ProductionOrders — embedded table in the "Production" Object Page section
// ---------------------------------------------------------------------------

annotate service.ProductionOrders with {
  status              @title: 'Status';
  plannedStart        @title: 'Planned Start';
  plannedEnd          @title: 'Planned End';
  actualStart         @title: 'Actual Start';
  actualEnd           @title: 'Actual End';
  estimatedCompletion @title: 'Estimated Completion';
};

annotate service.ProductionOrders with @(
  UI.LineItem: [
    { Value: parent_ID,           Label: 'Order' },
    { Value: status,              Label: 'Status', Criticality: productionCriticality },
    { Value: plannedStart,        Label: 'Planned Start' },
    { Value: plannedEnd,          Label: 'Planned End' },
    { Value: estimatedCompletion, Label: 'Estimated Completion' },
  ]
);

// ---------------------------------------------------------------------------
// Payments — embedded table in the "Payments" Object Page section
// ---------------------------------------------------------------------------

annotate service.Payments with {
  amount @title: 'Amount';
  method @title: 'Method';
  paidAt @title: 'Paid At';
  status @title: 'Status';
};

annotate service.Payments with @(
  UI.LineItem: [
    { Value: parent_ID,    Label: 'Order' },
    { Value: customerName, Label: 'Customer' },
    { Value: amount,       Label: 'Amount' },
    { Value: method,       Label: 'Method' },
    { Value: paidAt,       Label: 'Paid At' },
    { Value: status,       Label: 'Status', Criticality: paymentTxCriticality },
  ]
);

// ---------------------------------------------------------------------------
// Deliveries — embedded table in the "Delivery" Object Page section
// ---------------------------------------------------------------------------

annotate service.Deliveries with {
  status         @title: 'Status';
  address        @title: 'Address';
  scheduledDate  @title: 'Scheduled Date';
  deliveredAt    @title: 'Delivered At';
  trackingNumber @title: 'Tracking Number';
};

annotate service.Deliveries with @(
  UI.LineItem: [
    { Value: parent_ID,      Label: 'Order' },
    { Value: customerName,   Label: 'Customer' },
    { Value: status,         Label: 'Status', Criticality: deliveryCriticality },
    { Value: scheduledDate,  Label: 'Scheduled Date' },
    { Value: trackingNumber, Label: 'Tracking Number' },
  ]
);

// ---------------------------------------------------------------------------
// Value help labels for other master data entities (plan item 11 groundwork)
// ---------------------------------------------------------------------------
annotate service.Customers with {
  name @title: 'Name';
  email @title: 'Email';
  phone @title: 'Phone';
  company @title: 'Company';
};

annotate service.Products with {
  code @title: 'Code';
  name @title: 'Name';
  unit @title: 'Unit';
  basePrice @title: 'Base Price';
};

annotate service.SalesOrders with @(
  UI.HeaderInfo : {
    TypeName       : 'Order',
    TypeNamePlural : 'Orders',
    Title          : { Value: orderNo },
    Description    : { Value: customer_ID },
  },
  UI.HeaderFacets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'StatusFacet',
      Target : '@UI.FieldGroup#HeaderStatus',
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'TotalFacet',
      Target : '@UI.FieldGroup#HeaderTotal',
    },
  ],
  UI.FieldGroup #HeaderStatus : {
    Data : [
      { Value: status, Criticality: statusCriticality },
    ],
  },
  UI.FieldGroup #HeaderTotal : {
    Data : [
      { Value: totalAmount, Label: 'Total' },
    ],
  },
);



// ---------------------------------------------------------------------------
// Customers — List Report + Object Page (Stage 2, Phase 2.3, PAGE 4)
// ---------------------------------------------------------------------------

annotate service.Customers with {
  name           @title: 'Name';
  company        @title: 'Company';
  email          @title: 'Email';
  phone          @title: 'Phone';
  numberOfOrders @title: 'Number of Orders';
};

annotate service.Customers with @(
  UI: {
    LineItem: [
      { Value: name,           Label: 'Name' },
      { Value: company,        Label: 'Company' },
      { Value: email,          Label: 'Email' },
      { Value: phone,          Label: 'Phone' },
      { Value: numberOfOrders, Label: 'Number of Orders' },
    ],

    HeaderInfo: {
      TypeName      : 'Customer',
      TypeNamePlural: 'Customers',
      Title         : { Value: name },
      Description   : { Value: company },
    },

    FieldGroup #CustomerInfo: {
      Data: [
        { Value: name },
        { Value: company },
      ],
    },
    FieldGroup #ContactInfo: {
      Data: [
        { Value: email },
        { Value: phone },
      ],
    },

    Facets: [
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'CustomerInfoFacet',
        Label : 'Customer Information',
        Target: '@UI.FieldGroup#CustomerInfo',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'ContactInfoFacet',
        Label : 'Contact Information',
        Target: '@UI.FieldGroup#ContactInfo',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'OrdersFacet',
        Label : 'Orders',
        Target: 'orders/@UI.LineItem',
      },
    ],

    SelectionFields: [ name, company ],
  }
);

annotate service.Customers with {
    name @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Customers',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : name, ValueListProperty : 'name' },
        ],
    };

    company @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'CustomerCompanies',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : company, ValueListProperty : 'company' },
        ],
    };
};


// ---------------------------------------------------------------------------
// Products — List Report + Object Page (Stage 2, Phase 2.3, PAGE 4)
// ---------------------------------------------------------------------------

annotate service.Products with {
  code        @title: 'Code';
  name        @title: 'Name';
  description @title: 'Description';
  unit        @title: 'Unit';
  basePrice   @title: 'Base Price';
};

annotate service.Products with {
  unit @Common : {
    ValueListWithFixedValues : true,
    ValueList : {
      $Type : 'Common.ValueListType',
      CollectionPath : 'UnitCodes',
      Parameters : [
        { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : unit, ValueListProperty : 'code' },
      ],
    },
  };
};

annotate service.Products with @(
  UI: {
    LineItem: [
      { Value: code,      Label: 'Code' },
      { Value: name,      Label: 'Name' },
      { Value: unit,      Label: 'Unit' },
      { Value: basePrice, Label: 'Base Price' },
    ],

    HeaderInfo: {
      TypeName      : 'Product',
      TypeNamePlural: 'Products',
      Title         : { Value: name },
      Description   : { Value: code },
    },

    FieldGroup #ProductInfo: {
      Data: [
        { Value: code },
        { Value: name },
        { Value: description },
        { Value: unit },
        { Value: basePrice },
      ],
    },

    FieldGroup #ProductSummary: {
      Data: [
        { Value: ordersThisMonth, Label: 'Orders this Month' },
        { Value: revenue,         Label: 'Revenue' },
        { Value: averageQuantity, Label: 'Average Quantity' },
      ],
    },

    Facets: [
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'ProductInfoFacet',
        Label : 'Product',
        Target: '@UI.FieldGroup#ProductInfo',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'ProductSummaryFacet',
        Label : 'Price / Product Summary',
        Target: '@UI.FieldGroup#ProductSummary',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'OrderHistoryFacet',
        Label : 'Order History',
        Target: 'orderItems/@UI.LineItem#ProductHistory',
      },
    ],

    SelectionFields: [ code, name, unit ],
  }
);

annotate service.OrderItems with @(
  UI.LineItem #ProductHistory: [
    { Value: parent.orderNo,   Label: 'Order' },
    { Value: parent.createdAt, Label: 'Order Date' },
    { Value: quantity,         Label: 'Quantity' },
    { Value: unitPrice,        Label: 'Unit Price' },
    { Value: lineTotal,        Label: 'Line Total' },
  ]
);

annotate service.Products with {
    code @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Products',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : code, ValueListProperty : 'code' },
        ],
    };

    name @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Products',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : name, ValueListProperty : 'name' },
        ],
    };
};

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------
annotate service.Materials with {
  code     @title: 'Code';
  name     @title: 'Material';
  unit     @title: 'Unit';
  unitCost @title: 'Cost';
  status   @title: 'Status';
};

annotate service.Materials with {
  unit @Common : {
    ValueListWithFixedValues : true,
    ValueList : {
      $Type : 'Common.ValueListType',
      CollectionPath : 'UnitCodes',
      Parameters : [
        { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : unit, ValueListProperty : 'code' },
      ],
    },
  };

  status @Common : {
    ValueListWithFixedValues : true,
    ValueList : {
      $Type : 'Common.ValueListType',
      CollectionPath : 'MaterialStatusCodes',
      Parameters : [
        { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : status, ValueListProperty : 'code' },
      ],
    },
  };
};

annotate service.Materials with @(
  UI: {
    LineItem: [
      { Value: code,     Label: 'Code' },
      { Value: name,     Label: 'Material' },
      { Value: unit,     Label: 'Unit' },
      { Value: unitCost, Label: 'Cost' },
      { Value: status,   Label: 'Status', Criticality: statusCriticality },
    ],

    HeaderInfo: {
      TypeName      : 'Material',
      TypeNamePlural: 'Materials',
      Title         : { Value: name },
      Description   : { Value: code },
    },

    FieldGroup #MaterialInfo: {
      Data: [
        { Value: code },
        { Value: name },
        { Value: unit },
        { Value: unitCost },
        { Value: status, Criticality: statusCriticality },
      ],
    },

    Facets: [
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'MaterialInfoFacet',
        Label : 'Material Information',
        Target: '@UI.FieldGroup#MaterialInfo',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'StockByWarehouseFacet',
        Label : 'Stock by Warehouse',
        Target: 'stocks/@UI.LineItem',
      },
    ],

    SelectionFields: [ code, name, unit, status ],
  }
);

annotate service.MaterialStocks with {
  warehouse @Common: {
    Text            : warehouse.name,
    TextArrangement : #TextOnly,
  };
};

annotate service.MaterialStocks with {
  quantityOnHand   @title: 'On Hand';
  reservedQuantity @title: 'Reserved';
  available        @title: 'Available';
  reorderThreshold @title: 'Threshold';
  stockStatus      @title: 'Status';
};

annotate service.MaterialStocks with @(
  UI.LineItem: [
    { Value: warehouse_ID,     Label: 'Warehouse' },
    { Value: quantityOnHand,   Label: 'On Hand' },
    { Value: reservedQuantity, Label: 'Reserved' },
    { Value: available,        Label: 'Available' },
    { Value: reorderThreshold, Label: 'Threshold' },
    { Value: stockStatus,      Label: 'Status', Criticality: stockCriticality },
  ]
);

annotate service.Materials with {
    code @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Materials',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : code, ValueListProperty : 'code' },
        ],
    };

    name @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Materials',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : name, ValueListProperty : 'name' },
        ],
    };
};

annotate service.MaterialStocks with {
  material @Common: {
    Text            : material.name,
    TextArrangement : #TextOnly,
  };
};

annotate service.MaterialStocks with @(
  UI.LineItem#WarehouseInventory: [
    { Value: material_ID,      Label: 'Material' },
    { Value: quantityOnHand,   Label: 'On Hand' },
    { Value: reservedQuantity, Label: 'Reserved' },
    { Value: available,        Label: 'Available' },
    { Value: stockStatus,      Label: 'Status', Criticality: stockCriticality },
  ]
);

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------
annotate service.Warehouses with {
  code     @title: 'Code';
  name     @title: 'Warehouse';
  location @title: 'Location';
};

annotate service.Warehouses with {
  totalMaterials @title: 'Total Materials';
  lowStockCount  @title: 'Low Stock';
  criticalCount  @title: 'Critical';
  stockValue     @title: 'Stock Value';
};

annotate service.Warehouses with @(
  UI: {
    LineItem: [
      { Value: code,     Label: 'Code' },
      { Value: name,     Label: 'Warehouse' },
      { Value: location, Label: 'Location' },
    ],

    HeaderInfo: {
      TypeName      : 'Warehouse',
      TypeNamePlural: 'Warehouses',
      Title         : { Value: name },
      Description   : { Value: location },
    },

    FieldGroup #WarehouseInfo: {
      Data: [
        { Value: name },
        { Value: code },
        { Value: location },
      ],
    },

    FieldGroup #WarehouseKPI: {
      Data: [
        { Value: totalMaterials },
        { Value: lowStockCount, Criticality: lowStockCriticality },
        { Value: criticalCount, Criticality: criticalCriticality },
        { Value: stockValue },
      ],
    },

    Facets: [
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'WarehouseKPIFacet',
        Label : 'Overview',
        Target: '@UI.FieldGroup#WarehouseKPI',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'WarehouseInfoFacet',
        Label : 'Warehouse Information',
        Target: '@UI.FieldGroup#WarehouseInfo',
      },
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'InventoryFacet',
        Label : 'Inventory',
        Target: 'stocks/@UI.LineItem#WarehouseInventory',
      },
    ],

    SelectionFields: [ code, name ],
  }
);

annotate service.Warehouses with {
    code @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Warehouses',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : code, ValueListProperty : 'code' },
        ],
    };

    name @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Warehouses',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : name, ValueListProperty : 'name' },
        ],
    };
};

annotate service.ProductionOrders with @readonly;

annotate service.ProductionOrders with @(
  Capabilities.InsertRestrictions.Insertable: false,
  Capabilities.DeleteRestrictions.Deletable: false,
  Capabilities.UpdateRestrictions.Updatable: false
);