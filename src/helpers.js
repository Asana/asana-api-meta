var inflect = require('inflect');
var _ = require('lodash');

/**
 * Helpers for code-generation templates
 */

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
  return prefix + text.trim().replace(/\n/g, "\n" + prefix);
}

function wrapStarComment(text) {
  return wrapComment(text, " * ");
}

function wrapHashComment(text) {
  return wrapComment(text, "# ");
}

_.merge(exports, {
  starComment: wrapStarComment,
  hashComment: wrapHashComment,
  plural: inflect.pluralize,
  single: inflect.singularize,
  camel: inflect.camelize,
  cap: inflect.capitalize,
  decap: inflect.decapitalize,
  snake: inflect.underscore,
  dash: inflect.dasherize,
  param: inflect.parameterize,
  human: inflect.humanize
});

