var exec = require('child_process').exec;
var fs = require('fs-extra');
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
    destPath: 'lib',
    resourceBaseName: function(resource) {
      return helpers.plural(resource);
    }
  }
};

var paths = {
  dist: function(lang) {
    return 'dist/' + lang;
  },
  repo: function(lang) {
    return 'dist/git/' + lang;
  },
  repoDest: function(lang) {
    return paths.repo(lang) + '/' + paths.repoDestRelative(lang);
  },
  repoDestRelative: function(lang) {
    return languages[lang].destPath;
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
  gulp.task('deploy-' + lang, function(cb) {
    var dest = paths.repoDest(lang);
    var repoRoot = paths.repo(lang);
    fs.removeSync(repoRoot);
    exec(
        'git clone --depth=1 git@github.com:' + languages[lang].repo +
            ' ' + repoRoot, function(err) {
      if (err) throw err;
      fs.mkdirpSync(dest);
      fs.copy(paths.dist(lang), dest, function(err) {
        if (err) throw err;
        exec('git add ' + paths.repoDestRelative(lang), {cwd: repoRoot}, function(err) {
          if (err) throw err;
          // TODO: add current version to commit message
          exec('git commit -a -m "Deploy from asana-api-meta"', {cwd: repoRoot}, function(err) {
            if (err) throw err;
            exec('git push origin master', {cwd: repoRoot}, function(err) {
              if (err) throw err;
              cb();
            });
          });
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
            path.extname = /^.*([.].*?)$/.exec(path.basename)[1];
            path.basename = languages[lang].resourceBaseName(resourceName);
          }))
          .pipe(gulp.dest(paths.dist(lang)));
    });
  });

  gulp.task('build-' + lang, ['clean-' + lang].concat(resourceNames.map(taskName)));
});

Object.keys(languages).forEach(function(lang) {
  gulp.task('clean-' + lang, function() {
    fs.removeSync(paths.dist(lang));
  });
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