var inflect = require('inflect');
var util = require('util');
var path = require('path')
var _ = require('lodash');
var fs = require('fs')
var yaml = require('js-yaml');

/**
 * Helpers for code-generation templates
 */

function _repeat(char, times) {
  var s = '';
  for (var i = 0; i < times; i++) {
    s += char;
  }
  return s;
}

/**
 * Wrap the interior of a multi-line comment at the 80-column boundary.
 *
 * @param {String} text
 * @param {String?} prefix
 * @param {Number?} maxChars
 * @returns {*}
 */
function wrapComment(text, prefix, maxChars) {
  // TODO: actually wrap :)
  prefix = prefix || "";
  maxChars = maxChars || 78;
  return prefixLines(text, prefix);
}

function prefixLines(text, prefix, skipFirst) {
  return (skipFirst ? "" : prefix) + text.trim().replace(/\n/g, "\n" + prefix);
}

function wrapStarComment(text, indent) {
  return wrapComment(text, _repeat(' ', indent || 0) + ' * ');
}

function wrapHashComment(text, indent) {
  return wrapComment(text, _repeat(' ', indent || 0) + '# ');
}

function typeNameTranslator(lang) {
  return ({
    js: function(name) {
      return ({
        Id: 'String',
        Enum: 'String'
      })[name] || name;
    },
    java: function(name) {
      return ({
        Id: 'String',
        Enum: 'String'
      })[name] || name;
    }
  })[lang] || function(x) { return x; };
}

function paramsForAction(action) {
    // Figure out how many params will be consumed by the path and put the
  // first N required params there - the rest go in options.
  var numPathParams = (action.path.match(/%/g) || []).length;
  var results = {
    pathParams: [],
    explicitNonPathParams: [],
    optionParams: []
  };
  if (action.params) {
    action.params.forEach(function(param, index) {
      if (param.required && results.pathParams.length < numPathParams) {
        results.pathParams.push(param);
      } else if (param.explicit) {
        results.explicitNonPathParams.push(param);
      } else {
        results.optionParams.push(param);
      }
    });
  }
  return results;
}

// Removes line breaks but preserves paragraphs (double newlines).
// Also reserves line breaks denoted with an optional delimiter.
// TODO: make this un-hacky
function removeLineBreaks(text, opt_paragraph_delim) {
  var paragraph_delim = opt_paragraph_delim || "\n\n";
  text = text.replace(/\\\n/gm, "XX");
  text = text.replace(/\n\n/gm, "CC");
  text = text.replace(/\r\n|\n|\r/gm, " ");
  text = text.replace(/XX/g, "\n");
  return text.replace(/CC/g, paragraph_delim);
}

function genericPath(action, pathParams) {
  var path = action.path;
  _.forEach(pathParams, function(pathParam) {
    path = path.replace(/%./, pathParam.name + "-id");
  });
  return path;
}

function examplesForResource(resource) {
  var yamlFile = fs.readFileSync(path.join(__dirname, './templates/examples.yaml'), 'utf8');
  var examples = yaml.load(yamlFile);
  return examples[resource];
}

function curlExamplesForAction(action, resource_examples) {
  var action_examples = _.filter(resource_examples, function(example) {
    var regex = action.path.replace(/%s/g, "\\.+").replace(/\//g, "\\/");
    return example.method === action.method.toLowerCase() && example.endpoint.match(regex);
  });
  var curlExamples = [];
  _.forEach(action_examples, function(example) {
    var request = 'curl';
    if (example.method === 'put') {
      request += ' --request PUT';
    } else if (example.method === 'delete') {
      request += ' --request DELETE';
    }
    request += ' -H "Authorization: Bearer <personal_access_token>"';
    var url = 'https://app.asana.com/api/1.0' + example.endpoint;
    var data = [];
    if (example.request_data) {
      _.forEach(example.request_data, function(value, param_name) {
        var line;
        if (Array.isArray(value)) {   // exception for array types because of curl weirdness
          line = '-d "' + param_name + '[0]=' + value[0] + '"';
        } else if (param_name === 'file') {    // exception for files
          line = '--form "' + param_name + "=" + value + '"';
        } else {
          line = '-d "' + param_name + "=" + value + '"';
        }
        data.push(line);
      })
    }
    var response_status = "";
    var response = {};
    _.forEach(example.response, function(value, field_name) {
      if (field_name === 'status') {
        response_status = "HTTP/1.1 " + example.response.status;
      } else {
        response[field_name] = value;
      }
    });
    var ex = {
      description: action_examples.length > 1 ? example.description : null,
      request: request,
      url: url,
      dataForRequest: data,
      responseStatus: response_status,
      response: JSON.stringify(response, null, '  ')
    };
    curlExamples.push(ex);
  });
  return curlExamples;
}

var common = {
  prefix: prefixLines,
  plural: inflect.pluralize,
  single: inflect.singularize,
  camel: inflect.camelize,
  cap: inflect.capitalize,
  decap: inflect.decapitalize,
  snake: inflect.underscore,
  dash: inflect.dasherize,
  param: inflect.parameterize,
  human: inflect.humanize,
  paramsForAction: paramsForAction,
  examplesForResource: examplesForResource
};

var langs = {
  "java": _.merge({}, common, {
    typeName: typeNameTranslator("java"),
    comment: wrapStarComment
  }),
  "js": _.merge({}, common, {
    typeName: typeNameTranslator("js"),
    comment: wrapStarComment
  }),
  "php": _.merge({}, common, {
    typeName: typeNameTranslator("php"),
    comment: wrapStarComment
  }),
  "python": _.merge({}, common, {
    typeName: typeNameTranslator("python"),
    comment: wrapHashComment
  }),
  ruby: _.merge({}, common, {
    typeName: typeNameTranslator("ruby"),
    comment: wrapHashComment
  }),
  api_explorer: _.merge({}, common, {
    typeName: typeNameTranslator("js"),
    comment: wrapStarComment
  }),
  api_reference: _.merge({}, common, {
    typeName: typeNameTranslator("md"),
    indent: prefixLines,
    removeLineBreaks: removeLineBreaks,
    genericPath: genericPath,
    curlExamplesForAction: curlExamplesForAction
  })
};

module.exports = function(lang) {
  return langs[lang];
};
