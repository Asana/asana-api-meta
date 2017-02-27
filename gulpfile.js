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
var GitHubApi = require('github');
var dateFormat = require('dateformat');

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
    outputPath: 'lib/resources/gen',
    preserveRepoFiles: false
  },
  php: {
    repo: 'Asana/php-asana',
    outputPath: 'src/Asana/Resources/Gen',
    preserveRepoFiles: false
  },
  java: {
    repo: 'Asana/java-asana',
    outputPath: 'src/main/java/com/asana/resources/gen',
    preserveRepoFiles: false
  },
  python: {
    repo: 'Asana/python-asana',
    outputPath: 'asana/resources/gen',
    // Keep the __init__.py file there
    preserveRepoFiles: true
  },
  ruby: {
    repo: 'Asana/ruby-asana',
    outputPath: 'lib/asana/resources',
    preserveRepoFiles: false,
    skip: ['event']
  },
  api_explorer: {
    repo: 'Asana/api-explorer',
    outputPath: 'src/resources/gen',
    preserveRepoFiles: false
  },
  api_reference: {
    repo: 'Asana/asanastatic',
    outputPath: '_content/developers/api-reference',
    // Keep the other markdown pages and metadata there
    preserveRepoFiles: true
  }
};

var paths = {
  dist: function(lang) {
    return 'dist/' + lang;
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


// Store a single timestamp representing right now.
var nowTimestamp = dateFormat('yyyymmdd-HHMMss');


/**
 * Generate build and deploy rules for each language
 */
var resourceNames = resource.names();
Object.keys(languages).forEach(function(lang) {
  var config = languages[lang];
  var token = process.env.ASANA_GITHUB_TOKEN || null;
  var isProd = (process.env.PROD == '1');

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
   * Build rules, per resource.
   */
  var resourcesToSkip = config.skip || [];
  var resourcesToBuild = _.difference(resourceNames, resourcesToSkip);
  resourcesToBuild.forEach(function(resourceName) {
    gulp.task(resTaskName(resourceName), function() {
      // Support only local templates
      var templatePath = 'src/templates/' + lang;
      var resourceTemplateInfo = require('./' + templatePath).resource;

      // Load the resource yaml into a variable
      var resourceInstance = resource.load(resourceName);
      var templateHelpers = helpers(lang);
      templateHelpers.resources = resourceNames;
      // Load the resource file
      return gulp.src(templatePath + '/' + resourceTemplateInfo.template)
          .pipe( //Pipe it through a templating path with the language-specific helpers
              template(resourceInstance, {
                imports: templateHelpers,
                variable: 'resource'
              }))
          .pipe( //Pipe it through a file renaming step, i.e. resource.ejs becomes project.rb
              rename(resourceTemplateInfo.filename(resourceInstance, templateHelpers)))
          .pipe( //Pipe it to the output destination
              gulp.dest(paths.dist(lang)));
    });
  });
  gulp.task(
      'build-' + lang,
      resourcesToBuild.map(resTaskName));

  /**
   * Deploy
   */

  /**
   * @returns {Promise<String>} The commit message to provide for a deployment.
   */
  function createCommitMessage(user) {
    var version = readPackage().version;
    var revParse = Bluebird.promisify(git.revParse, git);

    var githubUserName = user.login;
    return revParse({args: '--abbrev-ref HEAD'}).then(function(branchName) {
      return revParse({args: '--short HEAD'}).then(function(commitHash) {
        var commitDesc = branchName.trim() ?
            util.format("%s/%s", commitHash, branchName.trim()) :
            commitHash;
        return util.format(
            "Deploy from asana-api-meta v%s (%s) by %s",
            version, commitDesc, githubUserName);
      });
    });
  }

  function getGitHubUser() {
    var github = githubClient(token);
    var getUser = Bluebird.promisify(github.user.get, github.user);
    return getUser({});
  }

  function deployWithGithubApi() {
    return getGitHubUser().then(function(user) {
      var branchName = isProd ?
          'api-meta-incoming' :
          (user.login + '-' + nowTimestamp);
      return createCommitMessage(user).then(function(commitMessage) {
        var repoParts = config.repo.split('/');
        return syncToGitHub({
          oauthToken: token,
          user: repoParts[0],
          repo: repoParts[1],
          localPath: paths.dist(lang),
          repoPath: paths.repoOutputRelative(lang),
          branch: branchName,
          baseBranch: 'master',
          createBranch: true,
          message: commitMessage,
          preserveRepoFiles: !!config.preserveRepoFiles,
          createPullRequest: isProd,
          debug: !!process.env.GULP_DEBUG
        });
      });
    });
  }

  function githubClient(token) {
    var github = new GitHubApi({
      version: '3.0.0',
      protocol: 'https',
      host: 'api.github.com'
    });
    github.authenticate({
      type: 'oauth',
      token: token
    });
    return github;
  }

  gulp.task(
      'deploy-' + lang,
      ['ensure-git-clean', 'build-' + lang],
      deployWithGithubApi);
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
      // Working directory must be clean for some operations.
      // For bumping the version, this prevents accidental commits of
      // unintended or partial changes.
      // For deployment, this ensures that the deploy is tagged with a commit
      // and that can be used to reference the exact state of the repo (if we
      // allowed changes then the commit would not tell us what the code
      // actually looked like).
      throw new Error('Git working directory not clean, will not proceed.');
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


/**
 * Copy the documents for api-reference to a sibling static site installation.
 * TODO: it appears that the convention might be to do all of those repos in
 * subdirs (as opposed to sibling dirs), based on paths.repoOutputRelative
 */

gulp.task('local-copy-api-reference', ['build-api_reference'], function(callback) {
  fs.copySync(paths.dist('api_reference'), "../vagrant-php7/asanastatic/" + paths.repoOutputRelative('api_reference'));
  callback()
});

/**
 * Setup gulp to watch the metadata and depoly to a working copy
 * of the static site. The only assumptions are that asana-api-meta
 * and the static site repo are in the same directory.
 */
gulp.task('watch-documents', function(callback) {
  gulp.watch("src/**/*.{js,yaml,ejs}", ['local-copy-api-reference']);
});

gulp.task('default', ['build', 'local-copy-api-reference']);
