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
  optimized: './optimized',
  packages: {
    'zest-social': {
      object: 'ZestSocial',
      filter: 'zest-social',
      root: './packages/zest-social',
      images: 'images',
      javascript: '.',
      bundle: 'zest-social.js',
      preview: 'preview.svg',
      zip: 'zest-social.zip',
    },
    'zest-pro': {
      object: 'ZestPro',
      root: './packages/zest-pro',
      images: 'images',
      javascript: '.',
      bundle: 'zest-pro.js',
      preview: 'preview.svg',
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
  return 'rm -Rf ' + packagePath(p.name, 'images', config.glob)
}).join(' && ')))

// TODO: break clean-pngs into clean-1x-pngs and clean-2x-pngs
gulp.task('clean-pngs', shell.task(mapPackages(function(p) {
  return 'rm -Rf ' + packagePath(p.name, 'images', '**/*.png')
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

function previewSvgPipeline(package, done) {
  var ZestIcons = require(packagePath(package.name, 'javascript', package.bundle))
  var svg = []
  var maxCol = 20
  var width = 24 * maxCol
  var iconsByCategory = _.groupBy(ZestIcons.all, 'category')
  var categoryUids = _.keys(iconsByCategory).sort().reverse()
  var categories = []
  var accumulatedWidth = ((maxCol * 2) + 1) * 24
  var accumulatedHeight = (categoryUids.length + 1) * 24

  categoryUids.forEach(function(uid) {
    var icons = iconsByCategory[uid].sort().reverse()
    var height = Math.floor(icons.length / maxCol) + (icons.length % maxCol > 0 ? 1 : 0)
    var width = maxCol
    var row = height
    var col = (icons.length % maxCol)
    if (col === 0) { col = 20 }

    var pixelWidth = ((width * 2) + 1) * 24
    var pixelHeight = ((height * 2) + 1) * 24
    accumulatedHeight += pixelHeight 
     
    var category = _.clone(ZestIcons.categories[uid])
    category.height = pixelHeight
    var contents = []
    
    contents.push('<rect x="0" y="0" width="' + pixelWidth + '" height="' + pixelHeight + '" fill="rgba(255,255,255,0)" />')

    icons.forEach(function(icon) {
      contents.push(
        '<g id="' + category.name + "/" + icon.name + '" transform="translate(' + (((col * 2) - 1) * 24) + ', ' + (((row * 2) - 1) * 24) + ')">' +
          '<rect id="Bounds" x="0" y="0" width="24" height="24" fill="#fff" />' +
          icon.paths +
        '</g>'
      )
      col -= 1
      if (col <= 0) {
        col = maxCol
        row -= 1
      }
    })

    category.contents = contents.join("\n")
    categories.push(category)
  })

  svg.push('<svg width="' + accumulatedWidth + '" height="' + accumulatedHeight + '" viewBox="0 0 ' + accumulatedWidth + ' ' + accumulatedHeight +'" xmlns="http://www.w3.org/2000/svg">')
  svg.push('<rect x="0" y="0" width="' + accumulatedWidth + '" height="' + accumulatedHeight + '" fill="#fff" />')

  var y = accumulatedHeight
  categories.forEach(function(category) {
    y -= category.height
    svg.push('<g id="' + category.name + '" transform="translate(0,' + y + ')">')
    svg.push(category.contents)
    svg.push('</g>')
    svg.push('<text x="24" y="' + y + '" style="font-size:12px;font-family:sans-serif">' + category.name + '</text>')
    y -= 24
  })

  svg.push('</svg>')
  fs.writeFile(packagePath(package.name, 'preview'), svg.join("\r\n"), done)
}
eachPackage(function(p) {
  gulp.task('preview-svg:' + p.name, function(done) { return previewSvgPipeline(p, done) } )
})
var previewSvg = gulp.parallel(mapPackages(function(p) { return 'preview-svg:' + p.name }))
gulp.task('preview-svg', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript, previewSvg)) 

function previewPngPipeline(package) {
  return gulp.src(packagePath(package.name, 'preview'))
    .pipe(raster({scale: 2}))
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest(packagePath(package.name)))
}
eachPackage(function(p) {
  gulp.task('preview-png:' + p.name, function(done) { return previewPngPipeline(p, done) } )
})
var previewPng = gulp.series(mapPackages(function(p) { return 'preview-png:' + p.name }))
gulp.task('preview-png', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript, previewSvg, previewPng))

var preview = gulp.series(previewSvg, previewPng)
gulp.task('preview', gulp.series('clean-javascript', 'clean-optimized', optimize, javascript, preview))

function svgPipeline(package) {
  var ZestIcons = require(packagePath(package.name, 'javascript', package.bundle))
  var uids = _.map(ZestIcons.all, function(i) { return i.uid }) 
  var globs = _.map(uids, function(uid) { return '**/' + uid + '.svg' })
  return gulp.src(config.optimized + '/' + config.glob)
    .pipe(filter(globs))
    .pipe(gulp.dest(packagePath(package.name, 'images')))
}
eachPackage(function(p) {
  gulp.task('svgs:' + p.name, function() { return svgPipeline(p) } )
})
var svgs = gulp.parallel(mapPackages(function(p) { return 'svgs:' + p.name }))
gulp.task('svgs', gulp.series('clean-optimized', 'clean-svgs', optimize, javascript, svgs)) 

function pngs1xPipeline(package) {
  var ZestIcons = require(packagePath(package.name, 'javascript', package.bundle))
  var uids = _.map(ZestIcons.all, function(i) { return i.uid }) 
  var globs = _.map(uids, function(uid) { return '**/' + uid + '.svg' })
  return gulp.src(config.src + '/' + config.glob)
    .pipe(filter(globs))
    .pipe(raster())
    .pipe(rename({extname: '.png'}))
    .pipe(gulp.dest(packagePath(package.name, 'images')))
}
eachPackage(function(p) {
  gulp.task('pngs@1x:' + p.name, function() { return pngs1xPipeline(p) } )
})
var pngs1x = gulp.series(mapPackages(function(p) { return 'pngs@1x:' + p.name }))
gulp.task('pngs@1x', gulp.series('clean-pngs', pngs1x))

function pngs2xPipeline(package) {
  var ZestIcons = require(packagePath(package.name, 'javascript', package.bundle))
  var uids = _.map(ZestIcons.all, function(i) { return i.uid }) 
  var globs = _.map(uids, function(uid) { return '**/' + uid + '.svg' })
  return gulp.src(config.src + '/' + config.glob)
    .pipe(filter(globs))
    .pipe(raster({scale: 2}))
    .pipe(rename({suffix: '@2x', extname: '.png'}))
    .pipe(gulp.dest(packagePath(package.name, 'images')))
}
eachPackage(function(p) {
  gulp.task('pngs@2x:' + p.name, function() { return pngs2xPipeline(p) } )
})
var pngs2x = gulp.series(mapPackages(function(p) { return 'pngs@2x:' + p.name }))
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
