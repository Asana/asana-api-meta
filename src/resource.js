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
  var content = fs.readFileSync(resourceDir + '/' + name + '.yaml', 'utf8');
  content = content.replace(/\!include\s+(\S+)/g, function(match, filename) {
    var included = fs.readFileSync(resourceDir + '/' + filename, 'utf8');
    // Strip document header
    return included.replace(/^---+/m, '');
  });
  return yaml.load(content);
}

exports.names = names;
exports.load = load;

