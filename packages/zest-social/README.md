Zest Social
-----------

#### 60+ premium icons meticulously handcrafted and lovingly optimized for web and mobile.

## Preview

![Zest Social](./preview.png)

## Installation

    npm install --save zest-pro

## Usage

### 1) SVG usage

All of the Zest Social icons are available in SVG and PNG format in the `images`
directory of the package. Icons are organized by category and UID. You can
browse the files [here](https://github.com/32pixelsCo/zest-icons/tree/master/packages/zest-social/images).

To use the SVG files in your project, reference them like you would any other
NPM package file.

### 2) JavaScript usage

Zest Social also includes a JavaScript file that contains all of the SVG paths for
the icons. Include `zest-pro.js` in your project like you would any other NPM
library. If you're using Webpack with Babel this looks like this:

```javascript
import ZestIcons from 'zest-pro'
```

The API for Zest is simple. All of the icons can be referenced by UID like this:

```javascript
ZestIcons['cool-face'] /* => Returns the Cool Face Emoji */
```

This returns an object for each icon that looks like this:

```javascript
{
  index: 149,
  uid: 'cool-face',
  name: 'Cool Face',
  category: 'emoji',
  paths: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5.07 8A7.997 7.997 0 0 1 12 4a7.997 7.997 0 0 1 6.93 4H5.07zm-.911 2.406a8 8 0 1 0 15.683 0C19.412 12.293 18.121 14 16 14c-2.268 0-3.59-1.967-3.91-4h-.18c-.32 2.033-1.642 4-3.91 4-2.123 0-3.413-1.708-3.841-3.594zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM8.757 15.03a1 1 0 0 1 1.21.714C10.227 16.614 11.16 17 12 17c.84 0 1.772-.385 2.033-1.256a1 1 0 0 1 1.937.496C15.452 17.988 13.785 19 12 19c-1.717 0-3.531-1.001-3.97-2.758a1 1 0 0 1 .727-1.212z"/>',
  keywords: ['smile', 'cool', 'beach'],
  previous: 'blowing-kiss-face',
  next: 'sleeping-face'
}
```

Using this API you can construct an SVG string for an icon like this:

```javascript
var paths = ZestIcons['cool-face'].paths
var iconString = '<svg width="24" height="24" viewBox="0 0 24 24">' + paths + '</svg>'
```

With a bit more imagination, you can create a function for constructing icon
elements like this:

```javascript
function createIconElement(uid, options) {
  if (!(uid in ZestIcons)) { throw new Error('Invalid UID for icon: ' + uid) }
  var options = options || {}
  var size = options.size || 24
  var color = options.color || '#000'
  var className = options.className || ''
  var style = options.valign ? 'valign:' + options.valign : ''
  var paths = ZestIcons[uid].paths
  var div = document.createElement('div')
  div.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" class="' + className + '" style="' + style + '"><g fill="' + color + '">' + paths + '</g></svg>'
  return div.children[0]
}

var el = document.getElementById('example')
var icon = createIconElement('cool-face', {color: '#f09', size: 48, valign: 'middle'})
el.appendChild(icon)
```

Or, if you're using React, you can create and use an `Icon` component like this:

```javascript
import React from 'react'
import ZestIcons from 'zest-pro'

const Icon = ({uid, size=24, color='', valign, className}) => {
  let paths
  let style = {}
  if (uid in ZestIcons) {
    paths = ZestIcons[uid].paths
  } else {
    throw new Error('Invalid UID for icon: ' + uid)
  }
  if (valign) {
    style['verticalAlign'] = valign
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      <g fill={color} dangerouslySetInnerHTML={{ __html: paths }} />
    </svg>
  )
}

const MyPage = () => <div>
  <h1>
    Hello Zest!
    <Icon uid="cool-face" color="#f09" size="48" valign="middle" />
  </h1>
</div>
```

## License

Zest Social is freely available under the MIT License. View the complete license [here](./LICENSE.md).
