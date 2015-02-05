# Asana API Metadata
Metadata for Asana API for generating client libraries and documenation

This repository contains descriptions of the various resources in the API and their endpoints. The metadata is rich in structural information and comments, such that we can use it to build both documentation and functioning client library objects.

It is currently used to build the following client libraries:

  * [`node-asana`](https://github.com/Asana/node-asana)

## Workflow

**In `asana-api-meta`:**
  1. Modify a resource or template
  2. `gulp build`        # builds and tests
  3. `git commit -a -m ...`
  4. `gulp bump-patch`   # or bump-feature or bump-release
  5. `gulp deploy`       # deploys all generated files to client libs (TODO: do automatically via travis)

Then, update the client libraries to use the new package, update their versions, etc.

## Resource Definitions

Resources are defined in individual YAML files under `src/resources`. The one-resource-per-file convention keeps the files manageable.

A schema is provided for resources, and the resources are validated against it during testing. It can be found in `test/resource_schema.json`, and uses the [JSON Schema](http://json-schema.org/) syntax, with the [`jsonschema`](http://json-schema.org/) Node package for validation.

The schemas make heavy use of the "anchor" and "alias" features of YAML, so the files can be more normalized and avoid excessive repetition. These are mostly used to define commonly-used components like types, properties, and parameters that appear in multiple (sometimes many, many) places.

## Templates

Templates for generating files from the resources are in `src/templates`. They use the [`lodash`](https://www.npmjs.com/package/lodash) library for generation.

The build system will, for each language `LANG` it is building (e.g. `LANG='js'`):
  1. For each resource:
    2. Read in the resource definition file, `src/resources/NAME.yaml`.
    3. For each file named `resource.EXT.template` file in `src/templates/LANG`:
      4. Execute the resource template against the resource definition.
      5. Output the result into the file `dist/LANG/NAME.EXT`.

The file `helpers.js` is scoped into the template namespace for use in the templates.
