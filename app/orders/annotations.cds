using SalesOrderService as service from '../../srv/service';

annotate service.SalesOrders with {
    customer @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Customers',
        Parameters : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : customer_ID, ValueListProperty : 'ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'name' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'email' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'phone' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'company' },
        ],
    }
};

annotate service.SalesOrders with {
    status @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'OrderStatusCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : status, ValueListProperty : 'code' },
            ],
        },
    };

    urgencyLevel @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'UrgencyCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : urgencyLevel, ValueListProperty : 'code' },
            ],
        },
    };

    paymentStatus @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'PaymentStatusCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : paymentStatus, ValueListProperty : 'code' },
            ],
        },
    };
};

annotate service.ProductionOrders with {
    status @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'ProductionStatusCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : status, ValueListProperty : 'code' },
            ],
        },
    };
};

annotate service.Payments with {
    method @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'PaymentMethodCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : method, ValueListProperty : 'code' },
            ],
        },
    };

    status @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'PaymentTxStatusCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : status, ValueListProperty : 'code' },
            ],
        },
    };
};

annotate service.Deliveries with {
    status @Common : {
        ValueListWithFixedValues : true,
        ValueList : {
            $Type : 'Common.ValueListType',
            CollectionPath : 'DeliveryStatusCodes',
            Parameters : [
                { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : status, ValueListProperty : 'code' },
            ],
        },
    };
};