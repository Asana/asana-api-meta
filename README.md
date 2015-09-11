# Asana API Metadata [![Build Status][travis-image]][travis-url]
Metadata for Asana API for generating client libraries and documenation

This repository contains descriptions of the various resources in the API and their endpoints. The metadata is rich in structural information and comments, such that we can use it to build both documentation and functioning client library objects.

It is currently used to build the following client libraries:

  * [`java-asana`](https://github.com/Asana/java-asana)
  * [`node-asana`](https://github.com/Asana/node-asana)
  * [`php-asana`](https://github.com/Asana/php-asana)
  * [`python-asana`](https://github.com/Asana/python-asana)
  * [`ruby-asana`](https://github.com/Asana/ruby-asana)
  
It is also used to build the [Asana API Reference](https://asana.com/developers/api-reference) in the developer documentation. 

## Contributor Workflow

### Making Changes

  1. Clone the repo:
     `git clone git@github.com:Asana/asana-api-meta.git`
  2. Make a topic branch:
     `git checkout -b my-topic-branch`
  3. Make changes on the topic branch.
  4. Run `gulp build` to build the output for all languages. You can inspect the final output in `dist/`.
  5. When satisfied, make a pull request.
  
## Owner Workflow

### Testing Proposed Changes

  1. Get a personal access token for GitHub and assign it to the environment variable `ASANA_GITHUB_TOKEN`:
     `export ASANA_GITHUB_TOKEN=...`
  2. Run a test deployment for a single language, e.g. `gulp deploy-js`. This will create a new branch in the target repo and deploy the generated files to that branch. The branch will be named for your GitHub username and a date-timestamp, for example `asanabot-20150531-012345`.
  3. Inspect the diffs on GitHub. If you need to make changes you can re-run the deploy and it will create a new branch.
  4. You can do a test deploy to all languages at once by running just `gulp deploy`.

### Committing

  1. Push changes to origin `git push origin my-topic-branch`.
  2. Make a pull request in GitHub. This will automatically create a task in Asana.
  3. Once your request is reviewed, it can be merged.
  
### Deploying

  1. Clone the repo, work on master.
  2. Bump the package version to indicate the [semantic version](http://semver.org/) change, using one of: `gulp bump-patch`, `gulp bump-feature`, or `gulp bump-release`
  3. Push changes to origin, including tags:
     `git push origin master --tags` 

### Propagating Changes to Client Libraries

  1. Travis will automatically build and deploy new code to the `api-meta-incoming` branch of all the repos, creating pull requests for each.
  2. Review and merge the pull requests as appropriate.
  3. Update package versions according to [semantic versioning](http://semver.org/), and push.


## Language Configuration

These are specified in `gulpfile.js` as `var languages = ...`. Each record has the following schema:

  * `repo`: Name of the repository holding the client library
  * `branch`: Name of the branch in the repository to push to
  * `templatePath`: [Optional] Path, relative to the root of `repo`, for a module defining the templates. There should be a file named `index.js` in that path. If omitted, will search for local templates in the `asana-api-meta` repository.
  * `outputPath`: Path, relative to the root of `repo`, where template output will go.

## Resource Definitions

Resources are defined in individual YAML files under `src/resources`. The one-resource-per-file convention keeps the files manageable.

A schema is provided for resources, and the resources are validated against it during testing. It can be found in `test/resource_schema.json`, and uses the [JSON Schema](http://json-schema.org/) syntax, with the [`jsonschema`](http://json-schema.org/) Node package for validation.

The schemas make heavy use of the "anchor" and "alias" features of YAML, so the files can be more normalized and avoid excessive repetition. These are mostly used to define commonly-used components like types, properties, and parameters that appear in multiple (sometimes many, many) places.

## Templates

This module uses templates for generating library source files from the resources.

The build system will, for each language `LANG` it is building (e.g. `LANG='js'`):
  1. For each resource:
    2. Read in the resource definition file, `src/resources/NAME.yaml`.
    3. Read in the template definition file, `src/templates/LANG/index.js`.
      4. Find the `resource` key.
      5. Read in the `template` to find the input template, and the `filename` function to generate the output filename.
    4. Execute the template against the resource definition.
    5. Output the result into the file `dist/LANG/OUTPUTFILE`.

All templates use the [`lodash`](https://www.npmjs.com/package/lodash) library for generation. `gulpfile.js` has the build rules that execute the templates. It provides various helpers to the template that are configurable on a per-library basis, by scoping the file `helpers.js` into the template namespace. These include utilities for common code-generation patterns.

[travis-url]: http://travis-ci.org/Asana/asana-api-meta
[travis-image]: https://api.travis-ci.org/Asana/asana-api-meta.svg?style=flat-square&branch=master
