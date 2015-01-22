var util = require('util');
var Resource = require('./resource');

/**
 * <%= comment %>
 * @class
 * @param {Dispatcher} dispatcher The API dispatcher
 */
function <%= name %>(dispatcher) {
  Resource.call(this, dispatcher);
}
util.inherits(<%= name %>, Resource);


<% _.each(actions, function(action) { %>

    <%= action.name %>

<% }); %>

module.exports = <%= name %>;

