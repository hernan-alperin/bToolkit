var bToolkit = (function(){
  // Browser Constants
  const FIREFOX   = 'firefox';
  const CHROME    = 'chrome';
  const SAFARI    = 'safari';
  const UNKNOWN   = 'unknown';
  const CURRENT_BROWSER = detectBrowser();

  var messageList = [];
  var pendingRequests = {};
  var chromeMessagePort = {};
  var safariMessagePort = {};

  // ### HELPERS ###############################################################
    /*
     * Adds a callback to the pending list
     * and returns the callback assigned id
     *
     *  @param cbk:
     *    callback to be added
     */
    function setCallback(cbk){
      var id = Date.now();
      while(pendingRequests.hasOwnProperty(''+id)){
        id = '_'+id
      }
      pendingRequests[id] = cbk;

      return id;
    }

    /*
     * Takes an id and an arguments array and executes
     * the pending callback
     *
     *  @param id:
     *    id of the stored callback
     *
     *  @param args:
     *    array with the arguments to be passed to the
     *    callback function
     */
    function executeCallback(id, args){
      if(typeof pendingRequests[id] == "function")
        pendingRequests[id].apply(pendingRequests[id], args);

      delete pendingRequests[id];
    }

  // ### MESSAGE PASSING #######################################################
    /*
     * Cross-browser message listener. Use this to communicate
     * with the main thread of the addon
     *
     *  @param msgName
     *    Name of the message you want to send
     *  @param data
     *    Extra data to send in the message
     */
    function sendMessage(msgName, data){
      switch(CURRENT_BROWSER){
        case FIREFOX:
          try {
            addon.port.emit(msgName, data);
          } catch (e) {
            self.port.emit(msgName, data);
          }
          break;
        case CHROME:
          //Hack in case it's needed to open the port
          if(!chromeMessagePort.hasOwnProperty(msgName)) {
            listenMessage(msgName, function(){});
          }
          chromeMessagePort[msgName].postMessage(data);
          break;
        case SAFARI:
          safari.self.tab.dispatchMessage(msgName, data);
          break;
      }
    }

    /*
     * Cross-browser message listener. Use this to communicate
     * with the main thread of the addon
     *
     *  @param msgName
     *    Name of the message you want to listen to
     *  @param data
     *    Callback to be executed whenever a message is received.
     *    This function will be called with a single parameter
     *    containing the response object
     */
    function listenMessage(msgName, cbk) {
      switch(CURRENT_BROWSER){
        case FIREFOX:
          try {
            addon.port.on(msgName, cbk);
          } catch (e) {
            self.port.on(msgName, cbk);
          }
          break;
        case CHROME:
          var port = chrome.extension.connect({name: msgName});
          chromeMessagePort[msgName] = port;
          port.onMessage.addListener(cbk);
          break;
        case SAFARI:
          safariMessagePort[msgName] = cbk;
          break;
      }
    }

    /*
     * listenMessage Safari Specific Code
     *  In Safari you can only listen to a single event from the main
     *  thread, then you have to find which message you are listening to
     */
    if (CURRENT_BROWSER == SAFARI) {
      safari.self.addEventListener("message", function(msgEvent) {
        if (safariMessagePort.hasOwnProperty(msgEvent.name)) {
          safariMessagePort[msgEvent.name](msgEvent.message);
        }
      }, false);
    }

    /*
     * Send a broadcast to every script. Useful for sending messages between
     * content-scripts with different execution environments.
     *  @param msg: message to be broadcasted
     */
    function sendBroadcast(msg){
      console.log('toolkit sending broadcast', JSON.stringify(msg))
      sendMessage("sendBroadcast", msg);
    }

    /*
     * Set a listener to broadcasts. This is the only way to listen to
     * broadcasts.
     *  @param cbk: Callback that will receive a single parameter, the message
     *              that is being broadcasted
     */
    // Flag to know if the main thread was signaled to store the port
    var bcastSet = false;
    function listenBroadcast(cbk) {
      listenMessage("listenBroadcast", cbk);
      if(!bcastSet) {
        console.log('sending listenBroadcast')
        sendMessage("listenBroadcast", {});
        bcastSet = true;
      }
    }

  // ### BROWSER DETECTION #####################################################

    /*
     * Returns the current browser
     */
    function detectBrowser() {
      try {
        if (chrome !== undefined  && chrome.extension !== undefined)
          return CHROME;
      } catch(i) {/* where i means ignore */}

      // Firefox scripts can run either as scripts invoked from trusted content
      // or a page-mod, and the global objects are different
      try { //trusted content
        if (addon !== undefined && addon.port !== undefined)
          return FIREFOX;
      } catch(i) {/* where i means ignore */}

      try { //page-mod
        if (self !== undefined && self.port !== undefined)
          return FIREFOX;
      } catch(i) {/* where i means ignore */}

      try {
        if (safari !== undefined && safari.extension !== undefined)
          return SAFARI;
      } catch(i) {/* where i means ignore */}

      return UNKNOWN;
    }

  // ### SCRIPT INJECTION ######################################################
    /*
     * Injects a set of scripts into the current active tab.
     *  @param scripts: The set of scripts to inject. Can be a string if
     *                  it's only one.
     */
    function injectScripts(scripts) {
      if (!(scripts instanceof Array)) {
        scripts = [scripts];
      }
      sendMessage("injectScripts", {
        scripts: scripts
      });
    }

  // ### REQUESTS #############################################################
    /*
     * Sends a message to the main thread asking
     * for a url. Allows Cross-Domain requests.
     *
     * @param type
     *    String, it can be ['GET'|'POST'] representing
     *    the kind of request that will be made
     *
     * @param url
     *    URL that wants to be retrieved
     *
     * @param data
     *    Key-Values that will be passed to the request
     *
     * @param cbk
     *    Callback that will be executed on completion. The
     *    parameter to that function is the response from
     *    the request
     *
     * @param [headers]
     *    An unordered collection of name/value pairs representing
     *    headers to send with the request.
     *
     * @checkInteractive
     *    boolean, set to true if the request should listen for
     *    response on readyState 3 (INTEERACTIVE) instead of 4 (COMPLETED)
     */
    function sendRequest(type, url, data, cbk, headers, checkInteractive) {
      // Move the callback to the pending list
      var id = setCallback(cbk);
      sendMessage("requestURL", {
        type: type,
        url: url,
        data: data,
        headers: headers,
        checkInteractive:checkInteractive,
        id:id
      });
    }

    /*
     * POST wrapper for sendRequest
     */
    function postRequest(url, data, cbk, headers, checkInteractive) {
      sendRequest(POST, url, data, cbk, headers, checkInteractive)
    }

    /*
     * GET wrapper for sendRequest
     */
    function getRequest(url, data, cbk, headers, checkInteractive) {
      sendRequest(GET, url, data, cbk, headers, checkInteractive)
    }

    /*
     * Listener to execute requests callbacks
     * The callbacks get a request parameter with the
     * following properties:
     *  text:     Response text
     *  json:     Response parsed as JSON
     *  status:   Response's Status (200, 404, etc.)
     */
    listenMessage("requestURL", function requestURLCbk(msg){
      executeCallback(msg.id,[msg.response]);
    });

  // ### VARIOUS ###############################################################
    /*
     * Opens a new tab in the current window
     *  @param options: Setup options, that can include:
     *    - url: URL to open [REQUIRED]
     *    - inBackground: set to true to open tab in background
     *    If it's a string, is the URL to be opened
     *  @param cbk Callback to be executed on tab opening
     */
    function openTab(options, cbk) {
      var id = setCallback(cbk);
      if (!options.hasOwnProperty('url')){
        //options is a string
        options = {
          url: options
        }
      }
      sendMessage("openTab", {
        id: id,
        url: options.url,
        inBackground: false || options.inBackground
      });
    }

    /*
     * Listener to execute openTab callbacks.
     * The callbacks get a message parameter with the
     * following properties:
     *  url:    The url of the loaded tab
     *  index:  Tab index of the new tab
     */
    listenMessage("openTab", function openTabCbk(msg) {
      executeCallback(msg.id, [msg.url, msg.index]);
    });

    /*
     * Sets the selected tab on focus
     *  @param index: index of the tab to set on focus, must be
     *                in the same window
     */
    function focusTab(index){
      sendMessage("focusTab",{
        index: index
      });
    }

    /*
     * Returns the url of the addon's base dir
     *
     * @param cbk
     *    Callback executed with the url
     *    The callback accepts the following parameter
     *      url:  The url of the addon's base dir
     */
    function getBaseURL(cbk) {
      var id = setCallback(cbk);
      sendMessage("getBaseURL", {
        id:id
      });
    }

    /*
     * Listener to execute getBaseURL callbacks.
     * The callbacks get a message parameter with the
     * following properties:
     *  url:  The url of the addon's base dir
     */
    listenMessage("getBaseURL", function getBaseURLCbk(msg) {
      executeCallback(msg.id, [msg.url]);
    });

  return {
    // Message Passing
    listenMessage:    listenMessage,
    sendMessage:      sendMessage,
    listenBroadcast:  listenBroadcast,
    sendBroadcast:    sendBroadcast,
    injectScripts:    injectScripts,

    // Browser Detection
    detectBrowser:    detectBrowser,
    CHROME:           CHROME,
    SAFARI:           SAFARI,
    FIREFOX:          FIREFOX,
    UNKNOWN:          UNKNOWN,

    // Requests
    sendRequest:      sendRequest,
    getRequest:       getRequest,
    postRequest:      postRequest,

    // Various
    openTab:          openTab,
    focusTab:         focusTab,
    getBaseURL:       getBaseURL
  }
})();
