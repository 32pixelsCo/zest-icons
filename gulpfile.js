var gulp = require("gulp")
var change = require("gulp-change")
var concat = require("gulp-concat")
var shell = require("gulp-shell")
var svgmin = require("gulp-svgmin")
var raster = require("gulp-raster")
var rename = require("gulp-rename")
var sort = require("gulp-sort")
var zip = require("gulp-zip")
var filter = require("gulp-filter")
var fs = require('fs')
var regexpQuote = require('regexp-quote')
var _ = require('lodash')


//
// Config
//

var config = {
  glob: '**/*.svg',
  src: 'src',
  dist: 'dist',
  preview: './preview.svg',
  optimized: './optimized',
  packages: {
    'zest-social': {
      object: 'ZestSocial',
      filter: 'zest-social',
      root: './packages/zest-social',
      svgs: 'images',
      pngs: 'images',
      javascript: '.',
      bundle: 'zest-social.js',
      zip: 'zest-social.zip',
    },
    'zest-pro': {
      object: 'ZestPro',
      root: './packages/zest-pro',
      svgs: 'images',
      pngs: 'images',
      javascript: '.',
      bundle: 'zest-pro.js',
      zip: 'zest-pro.zip'
    }
  },
  svgmin: {
    plugins: [{'removeTitle': true}]
  }
}


//
// Helper functions
//

function eachPackage(fn) {
  for (property in config.packages) {
    if (config.packages.hasOwnProperty(property)) {
      fn(config.packages[property], property)
    }
  }
}

function mapPackages(fn) {
  var result = []
  eachPackage(function(p) {
    result.push(fn(p))
  })
  return result
}

// Set name on packages
eachPackage(function(p, property) {
  p.name = property
})

function packagePath(name, dir, glob) {
  let parts = [config.packages[name].root]
  if (dir && config.packages[name][dir] !== '.') { parts.push(config.packages[name][dir]) }
  if (glob) { parts.push(glob) }
  return parts.join('/')
}

var prequel = "(function() {\n"
var sequel  = "})();"


//
// Tasks
//

gulp.task('clean-optimized', shell.task(
  'rm -Rf ' + config.optimized + '/' + config.glob
))

gulp.task('clean-javascript', shell.task(mapPackages(function(p) {
  return 'rm -Rf ' + packagePath(p.name, 'bundle')
}).join(' && ')))

gulp.task('clean-svgs', shell.task(mapPackages(function(p) {
  return 'rm -Rf ' + packagePath(p.name, 'svgs', config.glob)
}).join(' && ')))

// TODO: break clean-pngs into clean-1x-pngs and clean-2x-pngs
gulp.task('clean-pngs', shell.task(mapPackages(function(p) {
  return 'rm -Rf ' + packagePath(p.name, 'pngs')
}).join(' ')))

var clean = gulp.series(gulp.parallel('clean-optimized', 'clean-javascript', 'clean-svgs', 'clean-pngs'))
gulp.task('clean', clean)

function optimize() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(svgmin(config.svgmin))
    .pipe(gulp.dest(config.optimized))
}
gulp.task('optimize', gulp.series('clean-optimized', optimize))

function jsPipeline(package) {
  var categories = require('./data/categories')
  var icons = require('./data/icons')
  var order = require('./data/sort')
  var titlecase = function(string) {
    var words = string.split(/-|\s/)
    for (var i = 0; i < words.length; i++) {
      var word = words[i]
      if (i > 0 && ['a', 'an', 'the', 'of', 'and'].includes(word)) { continue }
      words[i] = word.charAt(0).toUpperCase() + word.slice(1)
    }
    return words.join(" ")
  }
  var extractName = function(uid, lookup) {
    var object = lookup[uid]
    if (object && 'name' in object) { return object['name'] }
    return titlecase(uid)
  }
  var before = fs.readFileSync("./src/before.js");
  var after = fs.readFileSync("./src/after.js");
  return gulp.src(config.optimized + '/' + config.glob)
    .pipe(sort({
      comparator: function(file1, file2) {
        var parts1 = file1.path.split("/")
        var parts2 = file2.path.split("/")
        var uid1 = parts1[parts1.length - 1].replace(/\.svg$/, '')
        var uid2 = parts2[parts2.length - 1].replace(/\.svg$/, '')
        var index1 = order.indexOf(uid1)
        var index2 = order.indexOf(uid2)
        if (index1 === index2) { return 0 }
        if (index1 > -1 && index2 === -1) { return -1 }
        if (index1 === -1 && index2 > -1) { return 1 }
        if (index1 > index2) { return 1 }
        if (index1 < index2) { return -1 }
      }
    }))
    .pipe(change(function(content) {
      /<svg.*?>([.]*)<\/svg>/g.test(content)
      var paths = content
            .replace(/<svg.*?>/g, '')
            .replace(/ fill="[^"]*"/g, '')
            .replace(/<\/svg>/g, '')
            .trim()
      var parts = this.fname.split("/")
      var categoryUid = parts[1]
      var uid = parts[2].replace(/\.svg$/, '')
      var name = extractName(uid, icons) 
      var categoryKeywords = categories[categoryUid] ? categories[categoryUid].keywords || [] : []
      var iconKeywords = icons[uid] ? icons[uid].keywords || [] : []
      var keywords = [].concat(categoryKeywords).concat(iconKeywords)
      var categoryPackages = categories[categoryUid] ? categories[categoryUid].packages || [] : []
      var iconPackages = icons[uid] ? icons[uid].packages || [] : []
      var packages = [].concat(categoryPackages).concat(iconPackages)
      var args = []
      args.push(JSON.stringify(uid))
      args.push(JSON.stringify(name))
      args.push(JSON.stringify(categoryUid))
      args.push("'" + paths + "'")
      if (keywords.length) { args.push(JSON.stringify(keywords)) }
      if (packages.length) { args.push(JSON.stringify(packages)) }
      return "  i(" + args.join(", ") + ")"
    }))
    .pipe(concat(package.bundle, {newLine: ",\n"}))
    .pipe(change(function(content) {
      if (package.filter) {
        var lines = content.split(",\n")
        var result = []
        var regexp = new RegExp('"' + regexpQuote(package.filter) + '"')
        lines.forEach(function(line) {
          if (regexp.test(line)) {
            result.push(line)
          }
        })
        return result.join(",\n")
      } else {
        return content
      }
    }))
    .pipe(change(function(content) {
      return (
        prequel +
        before +
        "ZestIcons.all = [\n" + content + "\n]\n\n" +
        "ZestIcons.categories = " + JSON.stringify(categories, "  ") + "\n\n" +
        after +
        sequel
      )
    }))
    .pipe(gulp.dest(packagePath(package.name, 'javascript')))
}
eachPackage(function(p) {
  gulp.task('javascript:' + p.name, function() { return jsPipeline(p) } )
})
var javascript = gulp.parallel(mapPackages(function(p) { return 'javascript:' + p.name }))
gulp.task('javascript', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript)) 

function previewSvg(done) {
  var ZestIcons = require(packagePath('zest-pro', 'javascript', config.packages['zest-pro'].bundle))
  var svg = []
  var row = 1
  var col = 1
  var maxCol = 41
  var categoryUid = null
  var icons = _.sortBy(ZestIcons.all, 'category')
  icons.forEach(function(icon) {
    if (categoryUid !== icon.category) {
      categoryUid = icon.category
      var category = ZestIcons.categories[categoryUid]
      row += col === 1 ? 1 : 3
      svg.push('<text x="24" y="' + row * 24 + '" style="font-size:12px;font-family:sans-serif">' + category.name + '</text>')
      row += 1
      col = 1
    }
    svg.push('<g transform="translate(' + 24 * col + ', ' + 24 * row + ')">' + icon.paths + '</g>')
    col += 2
    if (col >= maxCol) {
      row += 2
      col = 1
    }
  })
  var width = 24 * maxCol
  var height = 24 * (row + 2)
  svg.unshift('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#f5f5f5" />')
  svg.unshift('<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height +'" xmlns="http://www.w3.org/2000/svg">')
  svg.push('</svg>')
  fs.writeFile(config.preview, svg.join("\r\n"), done)
}
gulp.task('preview-svg', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript, previewSvg))

function previewPng() {
  return gulp.src(config.preview)
    .pipe(raster({scale: 2}))
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest('./'))
}
gulp.task('preview-png', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript, previewSvg, previewPng))

var preview = gulp.series(previewSvg, previewPng)
gulp.task('preview', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript, preview))

function svgPipeline(package) {
  var ZestIcons = require(packagePath(package.name, 'javascript', package.bundle))
  var uids = _.map(ZestIcons.all, function(i) { return i.uid }) 
  var globs = _.map(uids, function(uid) { return uid + '.svg' })
  return gulp.src(config.optimized)
    .pipe(filter(globs))
    .pipe(gulp.dest(packagePath(package.name, 'images')))
}
eachPackage(function(p) {
  gulp.task('svgs:' + p.name, function() { return svgPipeline(p) } )
})
var svgs = gulp.parallel(mapPackages(function(p) { return 'svgs:' + p.name }))
gulp.task('svgs', gulp.series('clean-optimized', 'clean-svgs', optimize, javascript, svgs)) 

function pngs1x() {
  var pipeline = gulp.src(config.src + '/' + config.glob)
    .pipe(raster())
    .pipe(rename({extname: '.png'}))
  eachPackage(function(p) {
    pipeline = pipeline.pipe(gulp.dest(packagePath(p.name, 'pngs')))
  })
  return pipeline
}
gulp.task('pngs@1x', gulp.series('clean-pngs', pngs1x))

function pngs2x() {
  var pipeline = gulp.src(config.src + '/' + config.glob)
    .pipe(raster({scale: 2}))
    .pipe(rename({suffix: '@2x', extname: '.png'}))
  eachPackage(function(p) {
    pipeline = pipeline.pipe(gulp.dest(packagePath(p.name, 'pngs')))
  })
  return pipeline
}
gulp.task('pngs@2x', gulp.series('clean-pngs', pngs2x))

var pngs = gulp.series(pngs1x, pngs2x)
gulp.task('pngs', gulp.series('clean-pngs', pngs))

gulp.task('build', gulp.series(
  clean,
  optimize,
  javascript,
  gulp.parallel(
    svgs,
    pngs
  ),
  preview
))

function release() {
  //TODO: reimplement
}
gulp.task('release', gulp.series('build', release))
