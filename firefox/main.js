// Required modules for bToolkit
const pageMod = require("page-mod");
const data = require("self").data;
const tabs = require("tabs");

// bToolkit counterpart
// worker: worker to listen for messages
let broadcastListeners = {};
function toolkitOnAttach(worker) {

  worker.port.on("injectScripts", function injectScripts(msg) {
    for (var idx = 0; idx < msg.scripts.length; idx++) {
      msg.scripts[idx] = data.url(msg.scripts[idx]);
    }
    toolkitOnAttach(tabs.activeTab.attach({
      contentScriptFile: msg.scripts
    }));
  });

  worker.port.on("sendBroadcast", function sendBroadcast(msg) {
    for (var i in broadcastListeners) {
      try {
        broadcastListeners[i].emit("listenBroadcast", msg)
      } catch (e) {
        delete broadcastListeners[i];
      }
    }
  });

  worker.port.on("listenBroadcast", function listenBroadcast(msg) {
    broadcastListeners[Date.now()] = this;
  });

}