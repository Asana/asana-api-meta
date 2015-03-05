# Asana API Metadata
Metadata for Asana API for generating client libraries and documenation

This repository contains descriptions of the various resources in the API and their endpoints. The metadata is rich in structural information and comments, such that we can use it to build both documentation and functioning client library objects.

It is currently used to build the following client libraries:

  * [`node-asana`](https://github.com/Asana/node-asana)

## Workflow

  1. Modify a resource or template
  2. `gulp build`        _# builds and tests changes_
  3. `git commit -a -m ...`
  4. `gulp bump-patch`   _# or `bump-feature` or `bump-release`_
  5. `git push origin master --tags`  _# pushes changes; travis will deploy all generated files to client libs_

Then, for each client library, pull and merge from the branch the deployment pushed to (usually `api-meta-incoming`), update versions, etc.

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

This module uses templates for generating library source files from the resources. These templates can either exist in this repository ("local templates") or in the client library ("remote templates").

The build system will, for each language `LANG` it is building (e.g. `LANG='js'`):
  1. For each resource:
    2. Read in the resource definition file, `src/resources/NAME.yaml`.
    3. Read in the template definition file (which may be in various locations)
      4. Find the `resource` key.
      5. Read in the `template` to find the input template, and the `filename` function to generate the output filename.
    4. Execute the template against the resource definition.
    5. Output the result into the file `dist/LANG/OUTPUTFILE`.

All templates use the [`lodash`](https://www.npmjs.com/package/lodash) library for generation. `gulpfile.js` has the build rules that execute the templates. It provides various helpers to the template that are configurable on a per-library basis, by scoping the file `helpers.js` into the template namespace. These include utilities for common code-generation patterns.

### Remote Templates

This is the preferred method for using templates since it places the template for the generated code in the same repository as the generated code will be pushed. That is, you don't have to look in two different places to see how the code is going to look.

### Local Templates

These are used if the language configuration does not have a `templatePath`, and it will assume the template package is in `src/templates/LANG` (that means it will load `src/templates/LANG/index.js`).

