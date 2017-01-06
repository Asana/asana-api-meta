var assert = require('assert');
var fs = require('fs');
var util = require('util');

var Validator = require('jsonschema').Validator;
var resource = require('../src/resource');

describe('Resource', function() {

  describe('#names', function() {
    it('should return known resources in order', function() {
      assert.deepEqual(resource.names(), [
        'attachment', 'custom_field_settings', 'custom_fields', 'event', 'project', 'section', 'story', 'tag', 'task',
        'team', 'user', 'webhook', 'workspace'
      ]);
    });
  });

  describe('#load', function() {
    var validator = new Validator();
    var schema = JSON.parse(fs.readFileSync('./test/resource_schema.json'));
    resource.names().forEach(function(name) {
      it('should load `' + name + '` conforming to resource schema', function() {
        var r = resource.load(name);
        var result = validator.validate(r, schema);
        var MAX_ERRORS = 10;
        if (result.errors.length > 0) {
          var lines = [
            "Schema validation failed with " + result.errors.length + " errors"
          ];
          result.errors.forEach(function(error, index) {
            if (index > MAX_ERRORS) {
              return;
            } else if (index === MAX_ERRORS) {
              lines.push("");
              lines.push("Too many errors, not showing them all.");
              return;
            }
            lines.push("");
            lines.push(
                "Error #" + (index + 1) + ": " + error.property + " " + error.message);
            lines.push("    on instance:");
            lines.push(util.inspect(error.instance));
          });
          // Massage output to be more readable in mocha reporter
          assert(false, lines.join("\n").replace(/\n/g, "\n     "));
        }
      });
    });
  });

});

