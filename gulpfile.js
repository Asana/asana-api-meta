var bump = require('gulp-bump');
var exec = require('child_process').exec;
var fs = require('fs-extra');
var git = require('gulp-git');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var tagVersion = require('gulp-tag-version');
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
    repo: 'Asana/node-asana',
    branch: 'api-meta-incoming',
    templatePath: 'src/templates',
    outputPath: 'lib/resources/gen'
  },
  php: {
    repo: 'Asana/php-asana',
    branch: 'api-meta-incoming',
    templatePath: 'templates',
    outputPath: 'src/Asana/Resources/Gen',
  },
  python: {
    repo: 'Asana/python-asana',
    branch: 'api-meta-incoming',
    // templatePath: 'src/templates',
    destPath: 'asana/resources/gen',
  },
  ts_tester: {
    repo: 'Asana/node-asana-tester',
    branch: 'api-meta-incoming',
    templatePath: 'src/resources/templates',
    outputPath: 'src/resources/gen'
  }
};

var paths = {
  dist: function(lang) {
    return 'dist/' + lang;
  },
  repo: function(lang) {
    return 'dist/git/' + lang;
  },
  repoOutput: function(lang) {
    return paths.repo(lang) + '/' + paths.repoOutputRelative(lang);
  },
  repoOutputRelative: function(lang) {
    return languages[lang].outputPath;
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
gulp.task('deploy', ['ensure-git-clean', 'build'].concat(Object.keys(languages).map(function(lang) {
  return 'deploy-' + lang;
})));

/**
 * Generate build and deploy rules for each language
 */
var resourceNames = resource.names();
Object.keys(languages).forEach(function(lang) {
  var config = languages[lang];
  var outputPath = paths.repoOutput(lang);
  var repoRoot = paths.repo(lang);
  var token = process.env.ASANA_GITHUB_TOKEN || null;

  function echoAndExec() {
    if (process.env.GULP_DEBUG) {
      console.log('+ ' + arguments[0]);
    }
    return exec.apply(null, arguments);
  }

  function resTaskName(resourceName) {
    return 'build-' + lang + '-' + resourceName;
  }

  /**
   * Clean work area for target repo
   */
  Object.keys(languages).forEach(function(lang) {
    gulp.task('clean-' + lang, function() {
      fs.removeSync(paths.dist(lang));
    });
  });

  /**
   * Checkout target repo, for build and deploy
   */
  gulp.task('checkout-' + lang, ['clean-' + lang], function(cb) {

    cloneRepo(cb);

    function cloneRepo(cb) {
      fs.removeSync(repoRoot);
      var url = (token !== null)
          ? util.format('https://github.com/%s', config.repo)
          : util.format('git@github.com:%s', config.repo);
      echoAndExec(
          util.format('git clone %s %s', url, repoRoot),
          switchToBranch);
    }

    function switchToBranch(err, stdout, stderr) {
      if (err) { cb(err); return; }
      var branch = config.branch;
      echoAndExec(
          util.format('git checkout --track -b %s origin/%s', branch, branch),
          {cwd: repoRoot},
          done);
    }

    function done(err, stdout, stderr) {
      if (err) { cb(err); return; }
      cb();
    }
  });

  /**
   * Build rules, per resource.
   */
  resourceNames.forEach(function(resourceName) {
    gulp.task(resTaskName(resourceName), ['checkout-' + lang], function() {
      // Support templates existing either locally or in target repo.
      var templatePath = config.templatePath ?
          (paths.repo(lang) + '/' + config.templatePath):
          ('src/templates/' + lang);
      var resourceTemplateInfo = require('./' + templatePath).resource;

      // Find the template info for resources
      var resourceInstance = resource.load(resourceName);
      var templateHelpers = helpers(lang);
      return gulp.src(templatePath + '/' + resourceTemplateInfo.template)
          .pipe(
              template(resourceInstance, {
                imports: templateHelpers,
                variable: 'resource'
              }))
          .pipe(
              rename(resourceTemplateInfo.filename(resourceInstance, templateHelpers)))
          .pipe(
              gulp.dest(paths.dist(lang)));
    });
  });
  gulp.task(
      'build-' + lang,
      resourceNames.map(resTaskName));

  /**
   * Deploy
   */
  gulp.task('deploy-' + lang, ['build-' + lang], function(cb) {
    var version;

    // We depend on the build step which checks out the repo, so we start by
    // setting our credentials so we can push to it.
    configureCredentials();

    // TODO: use some kind of promisify libraries to clean all this async code

    function configureCredentials(err, stdout, stderr) {
      if (err) { cb(err); return; }
      if (token !== null) {
        echoAndExec(
            'git config credential.helper "store --file=.git/credentials"',
            {cwd: repoRoot},
            writeCredentials);
      } else {
        copyToRepo();
      }
    }

    function writeCredentials(err, stdout, stderr) {
      if (err) { cb(err); return; }
      fs.writeFileSync(
          util.format('%s/.git/credentials', repoRoot),
          util.format('https://%s:@github.com', token));
      copyToRepo();
    }

    function copyToRepo(err, stdout, stderr) {
      if (err) { cb(err); return; }
      fs.mkdirpSync(outputPath);
      fs.copy(paths.dist(lang), outputPath, gitAdd);
    }

    function gitAdd(err) {
      if (err) { cb(err); return; }
      echoAndExec('git add ' + paths.repoOutputRelative(lang), {cwd: repoRoot}, gitCommit);
    }

    function gitCommit(err) {
      if (err) { cb(err); return; }
      echoAndExec(util.format('git commit --allow-empty -a -m "Deploy from asana-api-meta v%s"', version), {cwd: repoRoot}, gitTag);
    }

    function gitTag(err, stdout, stderr) {
      if (err) { cb(err); return; }
      version = readPackage().version;
      echoAndExec(util.format('git tag -f "v%s"', version), {cwd: repoRoot}, gitPush);
    }

    function gitPush(err) {
      if (err) { cb(err); return; }
      echoAndExec(
          util.format('git push --tags origin %s', config.branch),
          {cwd: repoRoot},
          done);
    }

    function done(err, stdout, stderr) {
      if (err) { cb(err); return; }
      cb();
    }
  });
});

/**
 * Bumping version number and tagging the repository with it.
 * Please read http://semver.org/
 *
 * You can use the commands
 *
 *     gulp bump-patch     # makes v0.1.0 → v0.1.1
 *     gulp bump-feature   # makes v0.1.1 → v0.2.0
 *     gulp bump-release   # makes v0.2.1 → v1.0.0
 *
 * To bump the version numbers accordingly after you did a patch,
 * introduced a feature or made a backwards-incompatible release.
 */
function bumpVersion(importance) {
  return gulp.src(['./package.json'])
      .pipe(bump({type: importance}))
      .pipe(gulp.dest('./'))
      .pipe(git.commit('bump package version'))
      .pipe(tagVersion());
}
gulp.task('bump-patch', ['ensure-git-clean'], function() {
  return bumpVersion('patch');
});
gulp.task('bump-feature', ['ensure-git-clean'], function() {
  return bumpVersion('minor');
});
gulp.task('bump-release', ['ensure-git-clean'], function() {
  return bumpVersion('major');
});

/**
 * Ensure that the git working directory is clean.
 */
gulp.task('ensure-git-clean', function() {
  git.status(function(err, out) {
    if (err) { throw err; }
    if (!/working directory clean/.exec(out)) {
      throw new Error('Git working directory not clean, will not bump version');
    }
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

