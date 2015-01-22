var util = require('util');
var Resource = require('./resource');

/**
<%= wrapComment(comment, ' *') %>
 * @class
 * @param {Dispatcher} dispatcher The API dispatcher
 */
function <%= cap(name) %>(dispatcher) {
  Resource.call(this, dispatcher);
}
util.inherits(<%= cap(name) %>, Resource);

<% _.each(actions, function(action) { %>

<%= action.name %>
<% }); %>

module.exports = <%= cap(name) %>;

