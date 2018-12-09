ZestIcons.all.forEach(function(icon) {
  ZestIcons[icon.uid] = icon
})
ZestIcons.all.forEach(function(icon) {
  icon.previous = ZestIcons.all[icon.index - 1]
  icon.next = ZestIcons.all[icon.index + 1]
})

ZestIcons.count = count

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = ZestIcons
} else {
  window.ZestIcons = ZestIcons
}
