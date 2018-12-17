function titlecase(string) {
  var words = string.split(/-|\s/)
  for (var i = 0; i < words.length; i++) {
    var word = words[i]
    if (i > 0 && ['a', 'an', 'the', 'of', 'and'].includes(word)) { continue }
    words[i] = word.charAt(0).toUpperCase() + word.slice(1)
  }
  return words.join(" ")
}

ZestIcons.all.forEach(function(icon) {
  ZestIcons[icon.uid] = icon
  var categoryUid = icon.category
  var category = ZestIcons.categories[categoryUid] || {}
  ZestIcons.categories[categoryUid] = category
  category.uid = category.uid || categoryUid
  category.name = category.name || titlecase(category.uid) 
  category.icons = category.icons || []
  category.icons.push(icon)
})

ZestIcons.all.forEach(function(icon) {
  var previous = ZestIcons.all[icon.index - 1]
  var next = ZestIcons.all[icon.index + 1]
  icon.previous = previous ? previous.uid : null
  icon.next = next ? next.uid : null
})

ZestIcons.count = count

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = ZestIcons
} else {
  window.ZestIcons = ZestIcons
}
