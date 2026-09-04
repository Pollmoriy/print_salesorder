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

annotate service.SalesOrders with @(
  UI: {
    // List Report table columns
    LineItem: [
      { Value: orderNo,               Label: 'Order No' },
      { Value: customer_ID,           Label: 'Customer' },
      { Value: status,                Label: 'Status',   Criticality: statusCriticality },
      { Value: urgencyLevel,          Label: 'Urgency' },
      { Value: createdAt,             Label: 'Order Date' },
      { Value: requestedDeliveryDate, Label: 'Delivery Date' },
      { Value: totalAmount,           Label: 'Total' },
      { Value: paymentStatus,         Label: 'Payment Status' },
    ],

    // Object Page header
    HeaderInfo: {
      TypeName      : 'Order',
      TypeNamePlural: 'Orders',
      Title         : { Value: orderNo },
      Description   : { Value: status },
    },

    // Object Page — General Information section
    FieldGroup #GeneralInfo: {
      Data: [
        { Value: customer_ID },
        { Value: createdAt },
        { Value: urgencyLevel },
        { Value: requestedDeliveryDate },
        { Value: status },
        { Value: paymentStatus },
      ],
    },
    Facets: [{
      $Type : 'UI.ReferenceFacet',
      ID    : 'GeneralInfoFacet',
      Label : 'General Information',
      Target: '@UI.FieldGroup#GeneralInfo',
    }],

    // Filter bar — the 5 required filters (plan item 10) + payment status
    SelectionFields: [
      status,
      customer_ID,
      createdAt,
      requestedDeliveryDate,
      urgencyLevel,
      paymentStatus,
    ],
  }
);

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