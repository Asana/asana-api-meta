var fs = require('fs-extra');
var git = require('gulp-git');
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

/**
 * Environment
 */
var languages = {
  js: {
    repo: 'Asana/node-asana-gen',
    destPath: '/lib'
  }
};

var paths = {
  dist: function(lang) {
    return 'dist/' + lang;
  },
  repo: function(lang) {
    return 'dist/repos/' + lang;
  },
  repoDest: function(lang) {
    return 'dist/repos/' + lang + languages[lang].destPath;
  }
};

/**
 * High-level tasks
 */

// Build all languages
gulp.task('build', ['test'].concat(Object.keys(languages).map(function(lang) {
  return 'build-' + lang;
})));

// Deploy languages
gulp.task('deploy', ['build'].concat(Object.keys(languages).map(function(lang) {
  return 'deploy-' + lang;
})));

/**
 * Generate deploy rules for each language
 */
Object.keys(languages).forEach(function(lang) {
  gulp.task('deploy-' + lang, function(done) {
    fs.remove(paths.repo(lang), function(err) {
      if (err) throw err;
      git.clone(languages[lang].repo, paths.repo(lang), {args: '--depth=1'}, function(err) {
        if (err) throw err;
        fs.mkdirpSync(paths.repoDest(lang));
        fs.copy(paths.dist(lang), paths.repoDest(lang), function(err) {
          if (err) throw err;
          done();
        });
      });
    });
  });
});

/**
 * Generate build rules for each resource in each language.
 */
var resourceNames = resource.names();
Object.keys(languages).forEach(function(lang) {

  function taskName(resourceName) {
    return 'build-' + lang + '-' + resourceName;
  }

  resourceNames.forEach(function(resourceName) {
    gulp.task(taskName(resourceName), function() {
      return gulp.src('src/templates/' + lang + '/resource.*.template')
          .pipe(template(resource.load(resourceName), {
            imports: helpers,
            variable: 'resource'
          }))
          .pipe(rename(function(path) {
            path.extname = /^.*[.](.*?)$/.exec(path.basename)[1];
            path.basename = resourceName;
          }))
          .pipe(gulp.dest(paths.dist(lang)));
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