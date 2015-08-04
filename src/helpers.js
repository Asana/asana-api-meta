var inflect = require('inflect');
var util = require('util');
var _ = require('lodash');

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
        Id: 'Number',
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

function samplePath(action, pathParams) {
  var path = action.path;
  _.forEach(pathParams, function(pathParam) {
    path = path.replace(/%./, pathParam.example_values[0]);
  });
  return path;
}

function addDataForSpecialActions(resource, action, data) {
  if (resource === 'task') {
    switch(action) {
      case 'addSubtask':
        // We don't have templates for subtasks but would like the copy to be different from regular tasks
        data.push('-d "name=\'Make trip to Cats R Us\'"');
        data.push('-d "notes=\'Petsmart is out of catnip\'"');
        break;
      case 'addProject':
        // Hacky, but this action can only take one param for the insertion location
        _.remove(data, function(param, index) {
          return index > 1;
        });
        break;
    }
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
  paramsForAction: paramsForAction
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
    comment: null,
    removeLineBreaks: removeLineBreaks,
    genericPath: genericPath,
    samplePath: samplePath,
    addDataForSpecialActions: addDataForSpecialActions
  })
};

module.exports = function(lang) {
  return langs[lang];
};
