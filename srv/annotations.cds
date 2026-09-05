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
    { Value: amount, Label: 'Amount' },
    { Value: method, Label: 'Method' },
    { Value: paidAt, Label: 'Paid At' },
    { Value: status, Label: 'Status', Criticality: paymentTxCriticality },
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
    { Value: status,         Label: 'Status', Criticality: deliveryCriticality },
    { Value: address,        Label: 'Address' },
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