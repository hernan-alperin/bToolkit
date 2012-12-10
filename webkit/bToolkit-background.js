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

/* ############# TOOLKIT COUNTERPART ############# */
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
  }
}
startListening();