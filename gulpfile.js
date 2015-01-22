var gulp = require('gulp');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var template = require('gulp-template');
var yaml = require('js-yaml');
var resource = require('./src/resource');
var helpers = require('./src/helpers');

/**
 * Paths
 */
var test = 'test/**/*';
var languages = ['js'];

/**
 * High-level tasks
 */

// Build all languages
gulp.task('build', ['test'].concat(languages.map(function(lang) {
  return 'build-' + lang;
})));


/**
 * Generate build rules for each resource in each language.
 */
var resourceNames = resource.names();
languages.forEach(function(lang) {

  function taskName(resourceName) {
    return 'build-' + lang + '-' + resourceName;
  }

  resourceNames.forEach(function(resourceName) {
    gulp.task(taskName(resourceName), function() {
      return gulp.src('src/templates/' + lang + '/resource.js')
          .pipe(template(resource.load(resourceName), {
            imports: helpers
          }))
          .pipe(rename(function(path) {
            path.basename = resourceName;
          }))
          .pipe(gulp.dest('dist/' + lang));
    });
  });

  gulp.task('build-' + lang, resourceNames.map(taskName));
});

/**
 * Tests the code with mocha.
 */
gulp.task('test', function(callback) {
  gulp.src(test)
      .pipe(mocha({
        reporter: process.env.TRAVIS ? 'spec' : 'nyan'
      }));
});