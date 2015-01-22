#!/usr/bin/python
var yaml = require('js-yaml');
var fs = require('fs');

var resourceDir = './src/resources';

function names() {
  var files = fs.readdirSync(resourceDir);
  return files.map(function(filename) {
    var match = /^(.*)\.yaml$/.exec(filename);
    return match ? match[1] : null;
  }).filter(function(name) {
    return name;
  }).sort();
}

function load(name) {
  return yaml.load(fs.readFileSync(resourceDir + '/' + name + '.yaml'));
}

exports.names = names;
exports.load = load;

