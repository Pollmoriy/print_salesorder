const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  require('./handlers/read-projections')(this);
  require('./handlers/validations')(this);
  require('./handlers/orders')(this);
  require('./handlers/production')(this);
  require('./handlers/payments')(this);
  require('./handlers/deliveries')(this);
  require('./handlers/materials')(this);
});