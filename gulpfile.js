var exec = require('child_process').exec;
var fs = require('fs-extra');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var template = require('gulp-template');
var util = require('util');
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
    },
    updatePackage: function(version, cb) {
      var repoRoot = paths.repo('js');
      var destPackage = readPackage(repoRoot + '/package.json');
      destPackage.version = version;
      writePackage(repoRoot + '/package.json', destPackage);
      exec('git add package.json', {cwd: repoRoot}, cb);
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

function readPackage(filename) {
  return fs.readJSONSync(filename || 'package.json');
}

function writePackage(filename, data) {
  return fs.writeJSONSync(filename || 'package.json', data);
}

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
  var config = languages[lang];
  gulp.task('deploy-' + lang, function(cb) {
    var dest = paths.repoDest(lang);
    var repoRoot = paths.repo(lang);
    fs.removeSync(repoRoot);
    exec(
        'git clone --depth=1 git@github.com:' + config.repo +
            ' ' + repoRoot, function(err) {
      if (err) { cb(err); return; }
      fs.mkdirpSync(dest);
      fs.copy(paths.dist(lang), dest, function(err) {
        var version = readPackage().version;
        config.updatePackage(version, function(err) {
          if (err) { cb(err); return; }

          exec('git add ' + paths.repoDestRelative(lang), {cwd: repoRoot}, function(err) {
            if (err) { cb(err); return; }

            exec(util.format('git commit -a -m "Deploy from asana-api-meta v%s"', version), {cwd: repoRoot}, function(err) {
              if (err) { cb(err); return; }

              exec(util.format('git tag -f "v%s"', version), {cwd: repoRoot}, function(err) {
                if (err) { cb(err); return; }

                exec('git push --tags origin master', {cwd: repoRoot}, function(err) {
                  if (err) { cb(err); return; }
                  cb();
                });
              });
            });
          });
        });
      });
    });
  });
});

function bumpVersion(version, importance) {
  var v = /^(\d+).(\d+).(\d+)$/.match(version);
  if (importance === 'major') {
    v[1] = parseInt(v[1], 10) + 1;
  } else if (importance === 'minor') {
    v[2] = parseInt(v[2], 10) + 1;
  } else {
    v[3] = parseInt(v[3], 10) + 1;
  }
  return [v[1], v[2], v[3]].join('.');
}

gulp.task('deploy-patch', ['ensure-git-clean'], function() {
  return bumpVersion('patch');
});
gulp.task('deploy-feature', ['ensure-git-clean'], function() {
  return bumpVersion('minor');
});
gulp.task('deploy-release', ['ensure-git-clean'], function() {
  return bumpVersion('major');
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

