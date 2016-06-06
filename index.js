'use strict';

var nglob = require('glob'),
    through = require('through2'),

    fs = require('fs'),
    path = require('path');

/////////////////////////////////////////////////
/////////////// Library Functions ///////////////
/////////////////////////////////////////////////

//
// Beware! Below lie demons unvanquished.
//

/**
 * Reorder so that the file with the same name as the package comes first. The
 * idea is that the file with the same name as the directory defines the
 * namespace. This, of course, enforces a java-like style of defining
 * namespaces, but it's at least easy to understand at a large scale because the
 * directory structure represents the package structure.
 *
 * I.e., If there are two directories
 *
 * foo/
 *    fib.js
 *    fob.js
 *    foo.js
 * bar/
 *    blah.js
 *    bar.js
 *    zed.js
 *
 * This will get reordered to
 *
 * foo/ -> [foo.js, fib.js, fob.js]
 * bar/ -> [bar.js, blah.js, zed.js]
 *
 */
function packageReorder() {
  var all = []
  return through.obj(function(file, enc, cb) {
    all.push(file);
    cb();
  }, function(cb) {
    var tr = [];
    var dirMap = {};
    var dirlist = []; // So we can order the directories.
    all.forEach((f) => {
      var fullpath = f.path;
      var ppath = path.parse(f.path);
      var dir = ppath.dir;
      if (!dirMap[dir]) {
        dirMap[dir] = [];
        dirlist.push(dir);
      }
      var splat = ppath.dir.split(path.sep)
      var last = splat[splat.length - 1]
      if (last === ppath.name) {
        // If the file is the directory name + .js, then it's the namespace file
        // and we bump it to teh top.
        dirMap[dir].unshift(f)
      } else {
        // otherwise, just stuff it on the end =)
        dirMap[dir].push(f)
      }
    });

    dirlist.forEach((dir) => {
      dirMap[dir].forEach((f) => {
        tr.push(f);
      });
    })
    tr.forEach((f) => {
      this.push(f);
    });
    cb();
  });
};


/**
 * A function to update the HTML files. The idea is that updateHtmlFiles takes a
 * glob of files and treats them as templates. It goes through and add
 * sources to these files then outputs them to  the specified outDir
 *
 * @param {string} filesGlob The glob of html files.
 * @param {string} header The header marker to indicate where to dump the JS
 *    sources.
 * @param {string} footer The footer marker to indicate where to dump the JS
 *    sources.
 * @param {string} outDir the output dir for the templated files.
 * @param {string} template the template to use.
 *
 * @return an object stream
 * Note: this gets the 'srcs' as part of the Vinyl file stream.
 */
function updateHtmlFiles(params) {
  var files = nglob.sync(params.filesGlob);
  var header = params.header;
  var footer = params.footer;
  var regexp = new RegExp(`(${header})(.|\n)*(${footer})`, 'g')
  var outDir = params.outDir;

  var dirHeader = params.dirHeader;
  var all = [];
  var template = params.template || '<script type="text/javascript" src="%s"></script>';

  return through.obj(function(file, enc, cb) {
    all.push(file);
    cb();
  }, function(cb) {
    var htmldir = path.dirname(files[0])

    var tags = [];
    var lastdir = null
    all.forEach((f) => {
      var relpath = path.relative(htmldir, f.path)

      var dir = path.dirname(f.path)
      if (dir !== lastdir) {
        tags.push(dirHeader.replace('%s', path.relative(htmldir, dir)))
        lastdir = dir
      }

      tags.push(template.replace('%s', relpath))
      this.push(f)
    })

    var text = tags.join('\n');

    if (!fs.existsSync(outDir)){
      fs.mkdirSync(outDir);
    }

    files.forEach((fname) => {
      var parsedPath = path.parse(fname)
      var outPath = path.join(outDir, parsedPath.base)
      if (!fs.existsSync(outPath)) {
        // First we write the template files.
        var contents = fs.readFileSync(fname, {encoding: 'UTF-8'})
        fs.writeFileSync(outPath, contents)
      }
      // Then, read from the newly-written file and overwrite the template
      // sections.
      var contents = fs.readFileSync(outPath, {encoding: 'UTF-8'})
      var replaced = contents.replace(regexp, '$1\n' + text + '\n$3')
      fs.writeFileSync(outPath, replaced)
    });

    cb();
  })
}

module.exports.
