var gulp = require("gulp")
var change = require("gulp-change")
var concat = require("gulp-concat")
var shell = require("gulp-shell")
var svgmin = require("gulp-svgmin")
var raster = require("gulp-raster")
var rename = require("gulp-rename")
var sort = require("gulp-sort")
var zip = require("gulp-zip")
var fs = require('fs')
var _ = require('lodash')

var config = {
  glob: '**/*.svg',
  src: 'src',
  optimized: './packages/zest-pro/images',
  pngs: ['./packages/zest-free/images', './packages/zest-pro/images'],
  javascript: './',
  bundle: './packages/zest-pro/zest-pro.js',
  dist: 'dist',
  zip: 'zest-icons.zip',
  preview: './preview.svg',
  svgmin: {
    plugins: [{'removeTitle': true}]
  }
}

var prequel = "(function() {\n"
var sequel  = "})();"

// TODO: break clean-pngs into clean-1x-pngs and clean-2x-pngs
gulp.task('clean-optimized', shell.task('rm -Rf ' + config.optimized + '/*'))
gulp.task('clean-javascript', shell.task('rm -Rf ' + config.bundle))
gulp.task('clean-pngs', shell.task('rm -Rf ' + config.pngs.join(' ')))

var clean = gulp.series(gulp.parallel('clean-optimized', 'clean-javascript', 'clean-pngs'))
gulp.task('clean', clean)

function optimize() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(svgmin(config.svgmin))
    .pipe(gulp.dest(config.optimized))
}
gulp.task('optimize', gulp.series('clean-optimized', optimize))

function javascript() {
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
      var args = []
      args.push(JSON.stringify(uid))
      args.push(JSON.stringify(name))
      args.push(JSON.stringify(categoryUid))
      args.push("'" + paths + "'")
      if (keywords.length) { args.push(JSON.stringify(keywords)) }
      return "  i(" + args.join(", ") + ")"
    }))
    .pipe(concat(config.bundle, {newLine: ",\n"}))
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
    .pipe(gulp.dest(config.javascript))
}
gulp.task('javascript', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript)) 

function previewSvg(done) {
  var ZestIcons = require(config.bundle)
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

function pngs1x() {
  var pipeline = gulp.src(config.src + '/' + config.glob)
    .pipe(raster())
    .pipe(rename({extname: '.png'}))
  config.pngs.forEach(function(p) {
    pipeline = pipeline.pipe(gulp.dest(p))
  })
  return pipeline
}
gulp.task('pngs@1x', gulp.series('clean-pngs', pngs1x))

function pngs2x() {
  var pipeline = gulp.src(config.src + '/' + config.glob)
    .pipe(raster({scale: 2}))
    .pipe(rename({suffix: '@2x', extname: '.png'}))
  config.pngs.forEach(function(p) {
    pipeline = pipeline.pipe(gulp.dest(p))
  })
  return pipeline
}
gulp.task('pngs@2x', gulp.series('clean-pngs', pngs2x))

var pngs = gulp.series(pngs1x, pngs2x)
gulp.task('pngs', gulp.series('clean-pngs', pngs))

gulp.task('build', gulp.series(
  clean,
  gulp.parallel(
    gulp.series(optimize, javascript),
    pngs
  ),
  preview
))

function release() {
  return gulp.src(
      [config.optimized + '/' + config.glob]
      .concat(_.map(config.pngs, function(p) { return p + '/**/*.png' }))
      .concat([config.bundle, 'LICENSE.md'])
    )
    .pipe(zip(config.zip))
    .pipe(gulp.dest(config.dist))
}
gulp.task('release', gulp.series('build', release))
