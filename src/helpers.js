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
  return text.replace(/CC/g, paragraph_delim).trim();
}

// Strip a string of leading/trailing whitespace
// unlike removeLineBreaks, this doesn't affect anything inside the text.
function stripWhitespace(text) {
  return text.replace(/^\s+/, '').replace(/\s+$/, '')
}

function idIfyParamName(name) {
  return name + "_gid";
}

function genericPath(action, pathParams) {
  var path = action.path;
  _.forEach(pathParams, function(pathParam) {
    path = path.replace(/%./, "{" + idIfyParamName(pathParam.name) + "}");
  });
  return path;
}

function examplesForResource(resource) {
  var yamlFile = fs.readFileSync(path.join(__dirname, './templates/examples.yaml'), 'utf8');
  var examples = yaml.load(yamlFile);
  return examples[resource];
}

// This is for "action class" as in "action_classes" which is, in this context,
// "class" as in css class. Basically, we can have a section of only text that
// falls under a blue header that can be linked to.
function curlExamplesForKeys(keys, resource_examples) {
  var key_examples = _.filter(resource_examples, function(example) {
    if (! example.key) return false;
    var index = _.findIndex(keys, function(key){
      return key === example.key
    })
    if(index != -1) {
      return true;
    }
    return false
  });
  return buildCurlExamples(key_examples);
}

// Note: this is "action" as in "endpoint description"; `GET /tasks` for example.
function curlExamplesForAction(action, resource_examples) {
  var action_examples = _.filter(resource_examples, function(example) {
    //TODO: this is a hack, simply to exclude selection-by-key vs selection-by-action/endpoint
    if (example.key) return false;
    var regex = "^" + action.path.replace(/%s/g, ".+").replace(/\//g, "\\/") + "(?!\\/)";
    if (action.path.startsWith('/portfolio_')) {
      console.log(regex);
      if (example.method) {
        console.log(example.endpoint);
        console.log(example.endpoint.match(regex));
      }
    }
    match = (example.method === action.method.toLowerCase() && example.endpoint.match(regex));
    if (action.path.startsWith('/portfolio_')) {
      console.log(match ? "true" : "false");
    }
    return match

  });
  return buildCurlExamples(action_examples);
}

function buildCurlExamples(examples) {
  var curlExamples = [];
  _.forEach(examples, function(example) {
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
          line = '--data-urlencode "' + param_name + '[0]=' + value[0] + '"';
        } else if (param_name === 'file') {    // exception for files
          line = '--form "' + param_name + "=" + value + '"';
        } else {
          line = '--data-urlencode "' + param_name + "=" + value + '"';
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
      description: examples.length > 1 ? example.description : null,
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

/**
 * Modeled after Ruby's classify inflection. It turns, for example, 'custom field settings'
 * to 'CustomFieldSettings'
 */
function classify(str) {
  return inflect.titleize(inflect.pluralize(str)).replace(/\s/gi, '');
}


/**
 * Construct a partial name based on a series of path parameters
 * The last argument (as in Ruby partials) will have a suffix appended.
 * (Unlike Ruby, the partial name need not start with an underscore)
 * Example:, the path [resource.name, "pre_description"] resolves to
 * "{repo_loc}/asana-api-meta/src/templates/api_reference/partials/{task, for example}/pre_description.ejs"
 */
function partialFilename() {
  var partial_path_arry = _.flatten(Array.prototype.slice.call(arguments));//Ideally: Array.from(arguments)); that's only implemented in newer JS impls
  var partial_path = partial_path_arry.join('/') + ".ejs";
  // path.join takes variable length arguments, so we pre-calculate a standard prefix and suffix
  var filename = path.join(__dirname, '/templates/api_reference/partials', partial_path);
  return filename;
}

/**
 * Test if we can stat a partial, given the path parameters (as in partialFilename)
 */
function partialExists() {
  try {
    var partial_path_arry = _.flatten(Array.prototype.slice.call(arguments));//Ideally: Array.from(arguments)); that's only implemented in newer JS impls
    fs.lstatSync(partialFilename(partial_path_arry));
    return true;
  } catch (e) {
    return false;
  }
}

/** Evaluate a partial, given the path parameters (as in partialFilename)
 * @param [partial_path_arry] {vararg(String, Array)}: [path, [...]] variable length path segments
 * @param [partial_context] {Object} : context argument for partial's evaluation environment
 *
 * Let's break that function signature down:
 * This function takes a variable number of strings or arrays of strings, followed by an optional
 * context object. The context object, if present, sets the context for the partial, i.e. sets
 * the variables in scope for the partial.
 * The path is processed as in partialFilename(), that is, is resolved to the location that contains
 * partials based on the arguments passed in partial_path_arry. More info on how these are processed
 * can be found in partialFilename().
 */
function partial() {
  var partial_path_arry = _.flatten(Array.prototype.slice.call(arguments));//Ideally: Array.from(arguments)); that's only implemented in newer JS impls
  var partial_context = {};
  // If the last element is not a string, we interpret it as a context for the partial.
  // This context is used to evaluate variables in that context.
  if (typeof arguments[arguments.length - 1] !== 'string')
  {
    partial_context = partial_path_arry.pop();
  }
  // Generally, partial_path_array will be a single element like ["partialname"]. It has the flexibility to look for nested directories, though,
  // by specifying directories in the array - so ["directory", "subdirectory", "partialname"] elements becomes directory/subdirectory/partialname.ejs
  if (partialExists(partial_path_arry)) {
    var template_content = fs.readFileSync(partialFilename(partial_path_arry), 'utf8');
    return stripWhitespace(_.template(template_content, _.merge(partial_context, langs.api_reference))); // Mixing in langs.api_reference includes the api_reference specific functions in this file.
  } else {
    return '';
  }
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
  title: inflect.titleize,
  classify: classify,
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
    stripWhitespace: stripWhitespace,
    partialExists: partialExists,
    partial: partial,
    partialFilename: partialFilename,
    idIfyParamName: idIfyParamName,
    genericPath: genericPath,
    curlExamplesForAction: curlExamplesForAction,
    curlExamplesForKeys: curlExamplesForKeys
  })
};

module.exports = function(lang) {
  return langs[lang];
};
