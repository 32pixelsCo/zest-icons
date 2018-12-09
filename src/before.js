var count = 0

var i = function(uid, name, category, paths, keywords) {
  return {
    index: count++,
    uid: uid,
    name: name,
    category: category,
    paths: paths,
    keywords: keywords
  }
}

var ZestIcons = {}
