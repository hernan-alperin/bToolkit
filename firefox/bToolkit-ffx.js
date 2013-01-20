const pageMod       = require("page-mod");
const data          = require("self").data;
const tabs          = require("tabs");
const request       = require("request").Request;
const simpleStorage = require("simple-storage");



// bToolkit counterpart ########################################################
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
        broadcastListeners[i].emit("listenBroadcast", msg);
      } catch (e) {
        delete broadcastListeners[i];
      }
    }
  });

  worker.port.on("listenBroadcast", function listenBroadcast(msg) {
    broadcastListeners[Date.now()] = this;
  });

  worker.port.on("requestURL", function requestURL(msg){
    let xhr = request({
      url: msg.url,
      content: msg.data,
      headers: msg.headers,
      forceAllowThirdPartyCookie: true,
      onComplete: function(response) {
        worker.port.emit("requestURL",{
          response: {
            text: response.text,
            json: response.json,
            status: response.status
          },
          id: msg.id
        });
      }
    });
    if(msg.type == 'GET')
      xhr.get();
    else
      xhr.post();
  });

  worker.port.on("setItemList", function setPreference(msg) {
    var items = msg.items;
    for (var keyName in items) {
      simpleStorage.storage[keyName] = items[keyName];
      items[keyName] = simpleStorage.storage[keyName];
    }
    worker.port.emit("setItemList", {
      items: items,
      id: msg.id
    });
  });

  worker.port.on("getItemList", function getPreference(msg) {
    var keyNames = msg.items, keyName;
    var items = {};
    for (var i = 0; i < keyNames.length; i++) {
      keyName = keyNames[i];
      items[keyName] = simpleStorage.storage[keyName];
    }
    worker.port.emit("getItemList", {
      items: items,
      id: msg.id
    });
  });

  worker.port.on("logMessage", function(msg) {
    console.log(msg.text);
  });

  worker.port.on("openTab", function(msg) {
    tabs.open({
      url: msg.url,
      onReady: function(tab){
        worker.port.emit("openTab", {
          id: msg.id,
          url: tab.url,
          index: tab.index
        });
      },
      inBackground: msg.inBackground
    });
  });

  worker.port.on("focusTab", function(msg) {
    tabs[msg.index].activate();
  });

  worker.port.on("getBaseURL", function getBaseURL(msg){
    worker.port.emit("getBaseURL", {
      url: data.url(''),
      id: msg.id
    });
  });

  worker.port.on("getCurrentURL", function getCurrentURL(msg){
    worker.port.emit("getCurrentURL", {
      url: tabs.activeTab.url,
      id: msg.id
    });
  });

}

// End of bToolkit counterpart #################################################
exports.onAttach = toolkitOnAttach;