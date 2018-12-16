var gulp = require("gulp")
var change = require("gulp-change")
var concat = require("gulp-concat")
var shell = require("gulp-shell")
var svgmin = require("gulp-svgmin")
var raster = require("gulp-raster")
var rename = require("gulp-rename")
var sort = require("gulp-sort")
var zip = require("gulp-zip")
var runSequence = require("run-sequence")
var fs = require('fs')
var _ = require('lodash')

var config = {
  glob: '**/*.svg',
  src: 'src',
  optimized: 'svgs',
  pngs: 'pngs',
  dist: 'dist',
  javascript: './',
  bundle: './zest.js',
  zip: 'zest-icons.zip',
  preview: './preview.svg',
  svgmin: {
    plugins: [{'removeTitle': true}]
  }
}

var prequel = "(function() {\n"
var sequel  = "})();"

gulp.task('clean-optimized', shell.task('rm -Rf ' + config.optimized + '/*'))
gulp.task('clean-javascript', shell.task('rm -Rf ' + config.bundle))
gulp.task('clean-pngs', shell.task('rm -Rf ' + config.pngs))

gulp.task('clean', ['clean-optimized', 'clean-javascript'])

gulp.task('optimize', ['clean-optimized'], function() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(svgmin(config.svgmin))
    .pipe(gulp.dest(config.optimized))
})

gulp.task('javascript', ['clean-javascript', 'optimize'], function() {
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
      var category = extractName(parts[0], categories)
      var uid = parts[1].replace(/\.svg$/, '')
      var name = extractName(uid, icons) 
      var categoryKeywords = categories[parts[0]] ? categories[parts[0]].keywords || [] : []
      var iconKeywords = icons[uid] ? icons[uid].keywords || [] : []
      var keywords = [].concat(categoryKeywords).concat(iconKeywords)
      var args = []
      args.push(JSON.stringify(uid))
      args.push(JSON.stringify(name))
      args.push(JSON.stringify(category))
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
        after +
        sequel
      )
    }))
    .pipe(gulp.dest(config.javascript))
})

gulp.task('preview-svg', ['javascript'], function(done) {
  var ZestIcons = require(config.bundle)
  var svg = []
  var row = 1
  var col = 1
  var maxCol = 41
  var category = null
  var icons = _.sortBy(ZestIcons.all, 'category')
  icons.forEach(function(icon) {
    if (category !== icon.category) {
      category = icon.category
      row += col === 1 ? 1 : 3
      svg.push('<text x="24" y="' + row * 24 + '" style="font-size:12px;font-family:sans-serif">' + category + '</text>')
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
})

gulp.task('preview-png', ['preview-svg'], function() {
  return gulp.src(config.preview)
    .pipe(raster({scale: 2}))
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest('./'))
})

gulp.task('preview', ['preview-svg', 'preview-png'])

gulp.task('pngs@1x', function() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(raster())
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest(config.pngs))
})

gulp.task('pngs@2x', function() {
  return gulp.src(config.src + '/' + config.glob)
    .pipe(raster({scale: 2}))
    .pipe(rename({suffix: '@2x', extname: '.png'}))
    .pipe(gulp.dest(config.pngs))
})

gulp.task('pngs', ['clean-pngs'], function(done) {
  runSequence('pngs@1x', 'pngs@2x', done)
})

gulp.task('build', function(done) {
  runSequence('optimize', 'pngs', 'preview', done)
})

gulp.task('release', ['build'], function() {
  return gulp.src([
      config.optimized + '/' + config.glob,
      config.pngs + '/**/*.png',
      config.bundle,
      'LICENSE.md'
    ])
    .pipe(zip(config.zip))
    .pipe(gulp.dest(config.dist))
})
