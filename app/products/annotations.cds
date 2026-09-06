using SalesOrderService as service from '../../srv/service';
annotate service.Products with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : code,
            },
            {
                $Type : 'UI.DataField',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'description',
                Value : description,
            },
            {
                $Type : 'UI.DataField',
                Value : unit,
            },
            {
                $Type : 'UI.DataField',
                Value : basePrice,
            },
            {
                $Type : 'UI.DataField',
                Label : 'ordersThisMonth',
                Value : ordersThisMonth,
            },
            {
                $Type : 'UI.DataField',
                Label : 'revenue',
                Value : revenue,
            },
            {
                $Type : 'UI.DataField',
                Label : 'averageQuantity',
                Value : averageQuantity,
            },
        ],
    },
);

