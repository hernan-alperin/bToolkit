// Browser Constants
const CHROME  = 'chrome';
const SAFARI  = 'safari';
const CURRENT_BROWSER = detectBrowser();

/*
 * Returns the current browser
 */
function detectBrowser() {
  try {
    if (chrome !== undefined  && chrome.extension !== undefined)
      return CHROME;
  } catch(i) {/* where i means ignore */}

  try {
    if (safari !== undefined && safari.extension !== undefined)
      return SAFARI;
  } catch(i) {/* where i means ignore */}

  return UNKNOWN;
}

// ### HELPERS #################################################################

// Some code is from Mozilla's Addon SDK
// Original code in https://github.com/mozilla/addon-sdk/blob/master/packages/addon-kit/lib/request.js

// Converts an object of unordered key-vals to a string that can be passed
// as part of a request
function makeQueryString(content) {
  // Explicitly return null if we have null, and empty string, or empty object.
  if (!content) {
    return null;
  }

  // If content is already a string, just return it as is.
  if (typeof(content) == "string") {
    return content;
  }

  // At this point we have a k:v object. Iterate over it and encode each value.
  // Arrays and nested objects will get encoded as needed. For example...
  //
  //   { foo: [1, 2, { omg: "bbq", "all your base!": "are belong to us" }], bar: "baz" }
  //
  // will be encoded as
  //
  //   foo[0]=1&foo[1]=2&foo[2][omg]=bbq&foo[2][all+your+base!]=are+belong+to+us&bar=baz
  //
  // Keys (including "[" and "]") and values will be encoded with
  // fixedEncodeURIComponent before returning.
  //
  // Execution was inspired by jQuery, but some details have changed and numeric
  // array keys are included (whereas they are not in jQuery).

  var encodedContent = [];
  function add(key, val) {
    encodedContent.push(fixedEncodeURIComponent(key) + "=" +
                        fixedEncodeURIComponent(val));
  }

  function make(key, val) {
    if (typeof(val) === "object" && val !== null) {
      for ( var k in val) {
        make(key + "[" + k + "]", val[k]);
      }
    }
    else {
      add(key, val)
    }
  }
  for (var k in content) {
    make(k, content[k]);
  }
  return encodedContent.join("&");
}

// encodes a string safely for application/x-www-form-urlencoded
// adheres to RFC 3986
// see https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Functions/encodeURIComponent
function fixedEncodeURIComponent (str) {
  return encodeURIComponent(str).replace(/%20/g, "+").replace(/!/g, "%21").
                                 replace(/'/g, "%27").replace(/\(/g, "%28").
                                 replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function startListening() {
  switch(CURRENT_BROWSER) {
    case SAFARI:
      safari.application.addEventListener("message", function(msgEvent) {
        var msg = msgEvent.message;
        var port = msgEvent.target.page;
        messageListeners[msgEvent.name](msg, port);
      });
      break;
    case CHROME:
      chrome.extension.onConnect.addListener(function(port) {
        port.onMessage.addListener( function(msg){
          messageListeners[port.name](msg, port);
        });
      });
      break;
  }
}

function dispatchMessage(port, msgName, msg) {
  switch(CURRENT_BROWSER) {
    case SAFARI:
      port.dispatchMessage(msgName,msg);
      break;
    case CHROME:
      port.postMessage(msg);
      break;
  }
}

var broadcastListeners = {};
var messageListeners = {

  "injectScripts": function(msg, port){
    switch(CURRENT_BROWSER) {
      case SAFARI:
        for (var idx = 0; idx < msg.scripts.length; idx++) {
          safari.extension.addContentScriptFromURL(
            msg.scripts[idx], null, null, true
          );
        }
      case CHROME:
        for (var idx = 0; idx < msg.scripts.length; idx++) {
          chrome.tabs.executeScript(null,{file:msg.scripts[idx]});
        }
        break;
    }
  },

  "sendBroadcast": function(msg, port){
    switch(CURRENT_BROWSER) {
      case SAFARI:
        // TODO
      case CHROME:
        console.log(broadcastListeners.length);
        for (var i in broadcastListeners) {
          try {
            dispatchMessage(broadcastListeners[i],"listenBroadcast",msg);
            console.log('message went through', broadcastListeners[i])
          } catch (e) {
            console.log('delete ', broadcastListeners[i].portId_);
            delete broadcastListeners[i];
          }
        }
        console.log(broadcastListeners, Object.keys(broadcastListeners).length);
        break;
    }
  },

  "listenBroadcast": function (msg, port) {
    console.log('broadcast listened')
    broadcastListeners[Date.now()] = port;
  },

  "requestURL": function (msg, port) {
    //This header is needed, so set it if missing
    if(!msg.headers) {
        msg.headers = {}
    }
    if(!msg.headers.hasOwnProperty('Content-Type') && msg.type == 'POST') {
        msg.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    var data = makeQueryString(msg.data);
    var url = msg.url;
    if (msg.type == "GET" && data) {
      // If the URL already has ? in it, then we want to just use &
      url = url + (/\?/.test(url) ? "&" : "?") + data;
    }
    var xhr = new XMLHttpRequest();
    xhr.open(msg.type, url);
    xhr.onreadystatechange = function() {
      if (
          (!msg.checkInteractive && xhr.readyState == 4) ||
          (msg.checkInteractive && xhr.readyState == 3)
         ) {
        var json = "";
        try {
          json = JSON.parse(xhr.responseText);
        } catch(i) {/* where i means ignore */}
        dispatchMessage(port, "requestURL", {
          response: {
            text: xhr.responseText,
            json: json,
            status: xhr.status
          },
          id: msg.id
        });
      }
    }

    for (var header in msg.headers)
      xhr.setRequestHeader(header, msg.headers[header]);

    xhr.send(msg.type == "POST" ? data : null);
  },

  "openTab": function(msg, port) {
    switch(CURRENT_BROWSER) {
      case SAFARI:
        // TODO
      case CHROME:
        chrome.tabs.create({
          url:    msg.url,
          active: !msg.inBackground
        }, function(tab){
          dispatchMessage(port, "openTab", {
            id: msg.id,
            url: tab.url,
            index: tab.id
          });
        })
        break;
    }
  },

  "focusTab": function(msg, port) {
    switch(CURRENT_BROWSER) {
      case SAFARI:
        // TODO
        break;
      case CHROME:
        chrome.tabs.update(msg.index, {
          active: true
        });
        break;
    }
  },

  "getBaseURL": function(msg, port) {
    var baseURL = "";
    switch(CURRENT_BROWSER) {
      case SAFARI:
        baseURL = safari.extension.baseURI;
        break;
      case CHROME:
        baseURL = chrome.extension.getURL("/");
        break;
    }

    dispatchMessage(port, "getBaseURL", {
      id: msg.id,
      url: baseURL
    });
  }

}
startListening();