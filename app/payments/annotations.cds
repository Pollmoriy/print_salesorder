using SalesOrderService as service from '../../srv/service';

annotate service.Payments with {
  parent @title: 'Order';
};

annotate service.Payments with {
  parent @Common: {
    Text            : parent.orderNo,
    TextArrangement : #TextOnly,
    ValueList       : {
      $Type          : 'Common.ValueListType',
      CollectionPath : 'SalesOrders',
      Parameters: [
        { $Type: 'Common.ValueListParameterInOut',      LocalDataProperty: parent_ID, ValueListProperty: 'ID' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'orderNo' },
      ],
    },
  };
};

annotate service.Payments with @(
  UI: {
    HeaderInfo: {
      TypeName      : 'Payment',
      TypeNamePlural: 'Payments',
      Title         : { Value: amount },
      Description   : { Value: status },
    },

    FieldGroup #PaymentInfo: {
        Data: [
            { Value: parent_ID },
            { Value: customerName, Label: 'Customer' },
            { Value: amount },
            { Value: method },
            { Value: paidAt },
            { Value: status, Criticality: paymentTxCriticality },
        ],
    },

    Facets: [
      {
        $Type : 'UI.ReferenceFacet',
        ID    : 'PaymentInfoFacet',
        Label : 'Payment',
        Target: '@UI.FieldGroup#PaymentInfo',
      }
    ],

    SelectionFields: [ status, method, paidAt ],
  }
);