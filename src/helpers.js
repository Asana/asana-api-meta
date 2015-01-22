var inflect = require('inflect');
var _ = require('lodash');

/**
 * Helpers for code-generation templates
 */
function wrapComment(text, prefix, maxChars) {
  // TODO
  maxChars = maxChars || 78;
  return text;
}

_.merge(exports, {
  wrapComment: wrapComment,
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

