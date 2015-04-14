var inflect = require('inflect');
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
  js: _.merge({}, common, {
    typeName: typeNameTranslator("js"),
    comment: wrapStarComment
  }),
  php: _.merge({}, common, {
    typeName: typeNameTranslator("php"),
    comment: wrapStarComment
  }),
  python: _.merge({}, common, {
    typeName: typeNameTranslator("python"),
    comment: wrapHashComment
  }),
  ruby: _.merge({}, common, {
    typeName: typeNameTranslator("ruby"),
    comment: wrapHashComment
  }),
  ts_tester: _.merge({}, common, {
    typeName: typeNameTranslator("js"),
    comment: wrapStarComment
  })
};

module.exports = function(lang) {
  return langs[lang];
};
