
/* globals define*/
define([],() => {
  const objectMap = {}; // Map of object handlers.
  const responseMap = {}; // Map of callbacks awaiting function results.
  let sequenceNumber = 0; // ID for matching requests to responses.

  const PostMessageProxy = {

    /**
     * Create a PostMessageProxy. This returns an object that you can
     * call like any other JavaScript object, by proxying methods
     * through to another window.
     *
     * When you call a method, rather than returning its return value,
     * it reutrns a Promise that you can resolve to get the return
     * value from the remote function.
     *
     * @param whichWindow The window (usually window.parent or a child)
     * @param objectId A string to identify the object you're proxying
     */
    create(whichWindow, objectId) {
      return new Proxy({ window: whichWindow }, {
        get(target, name) {
          if (name in target) {
            return target[name];
          }
          return () => {
            // eslint-disable-next-line
            const args = Array.slice(arguments);
            return new Promise((resolve, reject) => {
              const responseId = ++sequenceNumber;
              responseMap[responseId] = {
                resolve,
                reject
              };
              target.window.postMessage({
                postMessageProxy: objectId,
                responseId,
                fn: name,
                args
              }, '*');
            });
          };
        }
      });
    },

    /**
     * On the other window, call PostMessateProxy.receive() to hook up
     * an object that processes messages from a proxy in another window.
     */
    receive(objectId, obj) {
      objectMap[objectId] = obj;
    },

    /**
     * Handle 'message' events from postMessage, both when receiving a
     * message to invoke a function call, and receiving a message with
     * the return value of that function call. Both callbacks are
     * handled here so that we only bind one listener for each
     * relevant window.
     */
    messageHandler(evt) {
      const { data } = evt;
      if (data.postMessageProxy) {
        // Remote side (calling a function):
        const obj = objectMap[data.postMessageProxy];
        const { fn, args, responseId } = data;
        try {
          /* eslint-disable */
          evt.source.postMessage({
            postMessageProxyResult: responseId,
            result: obj[fn].apply(obj, args)
          }, window.location.origin);
          /* eslint-enable */
        } catch (e) {
          evt.source.postMessage({
            postMessageProxyResult: responseId,
            exception: e.toString(),
            stack: e.stack
          }, evt.origin);
        }
      } else if (data.postMessageProxyResult) {
        // Local side (return value):
        if (responseMap[data.postMessageProxyResult]) {
          const { resolve, reject } = responseMap[data.postMessageProxyResult];
          delete responseMap[data.postMessageProxyResult];
          if (data.exception) {
            const e = new Error();
            e.name = data.exception;
            e.stack = data.stack;
            reject(e);
          } else {
            resolve(data.result);
          }
        }
      }
    }
  };

  window.addEventListener('message', PostMessageProxy.messageHandler);

  return PostMessageProxy;

});
