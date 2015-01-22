var gulp = require('gulp');
var mocha = require('gulp-mocha');
//var vinylBuffer = require('vinyl-buffer');
//var vinylSourceStream = require('vinyl-source-stream');

/**
 * Paths
 */
var test = 'test/**/*';

/**
 * High Level Tasks
 */
gulp.task('deploy', ['test'], function() {

});

/**
 * Tests the code with mocha
 */
gulp.task('test', function(callback) {
  gulp.src(test)
      .pipe(mocha({
        reporter: process.env.TRAVIS ? 'spec' : 'nyan'
      }));
});