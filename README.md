#Browser Toolkit Library

This is a library to abstract the different Browser Extension APIs, to be able
to share the same codebase among those platforms.

The functionallity that you can access by using this library is a subset of
that provided by the different browsers, as the only APIs implemented here are
those present in all of the target platforms.

## Installation

To use the library you have some prerequisites:

**Firefox:**

  You'll need the [AddonSDK](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/)
  to build the extension

**Safari:**

  You'll need to be registered as a developer and enable the developer mode in
  Safari to be able to test/build the extensions

## Usage

The library consists of a main library file `bToolkit.js` and some counterparts
with needed implementation bits for each platform that need to be in a different
place:

* `/firefox/main.js`
* `/webkit/bToolkit-background.json`

To use the library, first include `bToolkit.js` in the same context as the
content-scripts where you want to use it. Then add the 
`webkit/bToolkit-background.js` in Webkit platforms as a background page, or for
 Firefox, paste the code from `/firefox/main.js` in your `/lib/main.js` file.

### Firefox example code

Example to attach the toolkit along a content-script (page-mod)

**In `/lib/main.js`:**

    let init_mod = pageMod.PageMod({
                    include: "*",
                    contentScriptFile: [
                      data.url("underscore-1.3.3.min.js"),
                      data.url("toolkit.js"),
                      data.url("init.js")
                    ],
                    onAttach: function(worker) {
                      toolkitOnAttach(worker)
                    }
                });

Example to atach the toolkit to a panel:

**In `/lib/main.js`:**

    var ext_panel = panel({
        contentURL: data.url('/html/panel.html'),
        width: 500,
        height: 300
    });

    //This is how the toolkit counterpart works for panels
    toolkitOnAttach(ext_panel);

### Chrome example code

**In `manifest.json`:**

    // Needed permissions
    "permissions": [
      "<all_urls>",
      "tabs"
    ],

    // As a content Script
    "content_scripts": [{
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "underscore-1.3.3.min.js",
        "toolkit.js",
        "init.js"
      ],
      "all_frames": false
    }],

    // Needed background files
    "background": {
      "scripts": [
        "data/libs/bToolkit-background.js"
      ],
      "persistent": true
    }

# Legal

The source for bToolkit is released under the GNU General Public License as
published by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.