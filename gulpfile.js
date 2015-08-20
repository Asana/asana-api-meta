var bump = require('gulp-bump');
var exec = require('child_process').exec;
var fs = require('fs-extra');
var git = require('gulp-git');
var syncToGitHub = require('sync-to-github');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var tagVersion = require('gulp-tag-version');
var template = require('gulp-template');
var util = require('util');
var yaml = require('js-yaml');
var resource = require('./src/resource');
var helpers = require('./src/helpers');
var _ = require('lodash');
var Bluebird = require('bluebird');

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
    outputPath: 'src/Asana/Resources/Gen'
  },
  java: {
    repo: 'Asana/java-asana',
    branch: 'api-meta-incoming',
    templatePath: 'templates',
    outputPath: 'src/main/java/com/asana/resources/gen'
    // destPath: 'src/main/java/com/asana/resources/gen'
  },
  python: {
    repo: 'Asana/python-asana',
    branch: 'api-meta-incoming',
    templatePath: 'templates',
    outputPath: 'asana/resources/gen'
  },
  ruby: {
    repo: 'Asana/ruby-asana',
    branch: 'api-meta-incoming',
    templatePath: 'lib/templates',
    outputPath: 'lib/asana/resources',
    skip: ['event']
  },
  api_explorer: {
    repo: 'Asana/api-explorer',
    branch: 'api-meta-incoming',
    templatePath: 'src/resources/templates',
    outputPath: 'src/resources/gen'
  },
  api_reference: {
    repo: 'AsanaOps/asanastatic',
    branch: 'api-meta-incoming',
    // templatePath: 'templates',
    outputPath: '_content/developers/api-reference',
    largeRepo: true,
    preserveRepoFiles: true
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

  function echoAndExec(command, options) {
    if (process.env.GULP_DEBUG) {
      console.log('+ ' + arguments[0]);
    }

    return new Bluebird(function(resolve, reject) {
      return exec(command, options, function(err, stdout, stderr) {
        if (err) {
          reject(err);
        } else {
          resolve(stdout);
        }
      });
    });
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
  gulp.task('checkout-' + lang, ['clean-' + lang], function() {
    if (config.largeRepo) {
      // Do not checkout large repos.
      return;
    }

    return Bluebird.resolve().then(function() {

      fs.removeSync(repoRoot);
      var url = (token !== null)
          ? util.format('https://github.com/%s', config.repo)
          : util.format('git@github.com:%s', config.repo);
      return echoAndExec(
          util.format('git clone %s %s', url, repoRoot));

    }).then(function() {

      var branch = config.branch;
      return echoAndExec(
          util.format('git checkout --track -b %s origin/%s', branch, branch),
          {cwd: repoRoot});

    }).then(function() {

      return echoAndExec('git merge origin/master', {cwd: repoRoot});

    });
  });

  /**
   * Build rules, per resource.
   */
  var resourcesToSkip = config.skip || [];
  var resourcesToBuild = _.difference(resourceNames, resourcesToSkip);
  resourcesToBuild.forEach(function(resourceName) {
    gulp.task(resTaskName(resourceName), ['checkout-' + lang], function() {
      // Support templates existing either locally or in target repo.
      var templatePath = config.templatePath ?
          (paths.repo(lang) + '/' + config.templatePath):
          ('src/templates/' + lang);
      var resourceTemplateInfo = require('./' + templatePath).resource;

      // Find the template info for resources
      var resourceInstance = resource.load(resourceName);
      var templateHelpers = helpers(lang);
      templateHelpers.resources = resourceNames
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
      resourcesToBuild.map(resTaskName));

  /**
   * Deploy
   */

  function deployToClonedRepo() {
    var version;

    // We depend on the build step which checks out the repo, so we start by
    // setting our credentials so we can push to it.
    return Bluebird.resolve().then(function() {

      if (token !== null) {
        return echoAndExec(
            'git config credential.helper "store --file=.git/credentials"',
            {cwd: repoRoot})
            .then(function() {
              fs.writeFileSync(
                  util.format('%s/.git/credentials', repoRoot),
                  util.format('https://%s:@github.com', token));
            });
      }

    }).then(function() {

      fs.mkdirpSync(outputPath);
      fs.copySync(paths.dist(lang), outputPath);
      return echoAndExec(
          util.format('git add %s', paths.repoOutputRelative(lang)),
          {cwd: repoRoot});

    }).then(function() {

      version = readPackage().version;
      return echoAndExec(
          util.format('git commit --allow-empty -a -m "Deploy from asana-api-meta v%s"', version),
          {cwd: repoRoot});

    }).then(function() {

      return echoAndExec(
          util.format('git push origin %s', config.branch),
          {cwd: repoRoot});

    });
  }

  function deployToLargeRepo() {
    var version = readPackage().version;
    var repoParts = config.repo.split('/');
    return syncToGitHub({
      oauthToken: token,
      user: repoParts[0],
      repo: repoParts[1],
      localPath: paths.dist(lang),
      repoPath: paths.repoOutputRelative(lang),
      branch: 'api-meta-incoming',
      message: util.format('Deploy from asana-api-meta v%s', version),
      preserveRepoFiles: config.preserveRepoFiles,
      pullToBranch: 'master',
      debug: !!process.env.GULP_DEBUG
    });
  }

  gulp.task(
      'deploy-' + lang,
      ['build-' + lang],
      config.largeRepo ? deployToLargeRepo : deployToClonedRepo);
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
