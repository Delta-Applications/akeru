
/* globals define*/
define([],() => {

  const READY_EVENT_TYPE = 'childWindowReady';

  /**
   * ChildWindowManager maintains the lifecycle of a child attention
   * window. When you instantiate a ChildWindowManager, no window
   * exists yet; use .whenReady() or postMessage() to call up the
   * child window and perform actions on it. Provided the child window
   * calls ChildWindowManager.fireReady(), this class takes care of
   * the bookkeeping to make sure that the child window is ready to
   * receive events before sending over any messages. Similarly, this
   * class acquires a CPU wake lock when opening the window to ensure
   * that your messages are delivered reliably without the phone going
   * to sleep while waiting for the child window to receive a message.
   */
  function ChildWindowManager(url) {
    this.url = url;
    this.childWindow = null;
    this.childWindowReady = false;
    this.childOnReadyCallbacks = [];
    this.releaseCpuLock = null;
    window.addEventListener('message', this);
  }

  ChildWindowManager.prototype = {

    /**
     * Post a message to the child window. If the window is not yet
     * open, acquire a CPU wake lock and open the window, then deliver
     * the message. Subsequent calls to postMessage will similarly
     * wait until the window is ready before delivery.
     */
    postMessage(message) {
      this.whenReady(() => {
        this.childWindow.postMessage(message, window.location.origin);
      });
    },

    /**
     * Closes the window. You may reinstantiate a window again by
     * sending another postMessage.
     */
    close() {
      window.running = false;
      if (this.childWindow && !this.childWindow.closed) {
        this.childWindow.close();
      }
      this.childWindow = null;
    },

    /**
     * Call a function when the window is ready and opened. This is
     * used internally by postMessage.
     */
    whenReady(callback) {
      if (!this.childWindow || this.childWindow.closed) {
        // this.childWindow = window.open(this.url, '_blank', 'attention');
        this.childWindowReady = false;
      }
      if (this.childWindowReady) {
        // eslint-disable-next-line
        callback();
      } else {
        this.childOnReadyCallbacks.push(callback);
      }
    },

    /** Private. Handle DOM events. */
    handleEvent(evt) {
      if (evt.data.type === READY_EVENT_TYPE) {
        this.childWindowReady = true;
        while (this.childOnReadyCallbacks.length) {
          const callback = this.childOnReadyCallbacks.shift();
          // eslint-disable-next-line
          callback();
        }
      }
    }
  };

  /**
   * Call this method from a child window when the child has loaded.
   * This fires a message to the parent window, instructing it to pass
   * along any queued events.
   */
  ChildWindowManager.fireReady = () => {
    if (!window.opener) {
      throw new Error('fireReady must be called from the child window.');
    }
    window.opener.postMessage({
      type: READY_EVENT_TYPE
    }, window.location.origin);
  };

  return ChildWindowManager;

});
