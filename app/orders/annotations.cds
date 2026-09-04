using SalesOrderService as service from '../../srv/service';
annotate service.SalesOrders with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'orderNo',
                Value : orderNo,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'urgencyLevel',
                Value : urgencyLevel,
            },
            {
                $Type : 'UI.DataField',
                Label : 'discountPercent',
                Value : discountPercent,
            },
            {
                $Type : 'UI.DataField',
                Label : 'requestedDeliveryDate',
                Value : requestedDeliveryDate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'totalAmount',
                Value : totalAmount,
            },
            {
                $Type : 'UI.DataField',
                Label : 'paidAmount',
                Value : paidAmount,
            },
            {
                $Type : 'UI.DataField',
                Label : 'paymentStatus',
                Value : paymentStatus,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'orderNo',
            Value : orderNo,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
        },
        {
            $Type : 'UI.DataField',
            Label : 'urgencyLevel',
            Value : urgencyLevel,
        },
        {
            $Type : 'UI.DataField',
            Label : 'discountPercent',
            Value : discountPercent,
        },
        {
            $Type : 'UI.DataField',
            Label : 'requestedDeliveryDate',
            Value : requestedDeliveryDate,
        },
    ],
);

annotate service.SalesOrders with {
    customer @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Customers',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : customer_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'email',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'phone',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'company',
            },
        ],
    }
};

