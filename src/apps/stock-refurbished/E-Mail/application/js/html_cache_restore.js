/*jshint browser: true */
/*global performance, console, Notification */

let _xstart = performance.timing.fetchStart -
              performance.timing.navigationStart;
window.plog = function(msg) {
  console.log(msg + ' ' + (performance.now() - _xstart));
};

(function() {
  // START COPY performance_testing_helper.js
  // A copy instead of a separate script because the gaia build system is not
  // set up to inline this with our main script element, and we want this work
  // to be done after the cache restore, but want to trigger the events that
  // may be met by the cache right away without waiting for another script
  // load after html_cache_restore.
  function dispatch(name) {
    if (!window.mozPerfHasListener) {
      return;
    }

    let now = window.performance.now();
    let epoch = Date.now();

    setTimeout(() => {
      let detail = {
        name: name,
        timestamp: now,
        epoch: epoch
      };
      let event = new CustomEvent('x-moz-perf', { detail: detail });

      window.dispatchEvent(event);
    });
  }

  ([
    'moz-chrome-dom-loaded',
    'moz-chrome-interactive',
    'moz-app-visually-complete',
    'moz-content-interactive',
    'moz-app-loaded'
  ].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        dispatch(eventName);
      }, false);
    }));

  window.PerformanceTestingHelper = {
    dispatch: dispatch
  };
  // END COPY performance_testing_helper.js
}());

/**
 * Apparently the event catching done for the startup events from
 * performance_testing_helper record the last event received of that type as
 * the official time, instead of using the first. So unfortunately, we need a
 * global to make sure we do not emit the same events later.
 * @type {Boolean}
 */
window.startupCacheEventsSent = false;

/**
 * Version number for cache, allows expiring cache.
 * Set by build process. Set as a global because it
 * is also used in html_cache.js.
 */
window.HTML_CACHE_VERSION = '96df5fc0bec33b934797ff2b213da754db174655';

/**
 * A function callback is registered if the model needs to be loaded before
 * final view determination can be done. This should be a rare event, but can
 * happen, see localOnModelLoaded for more details. config.js looks for this
 * callback.
 */
window.startupOnModelLoaded = null;

/**
 * Tracks if a mozSetMessageHandler has been dispatched to code. This only
 * exists to help us be efficient on closing the app in the case of notification
 * close events. If the notification system improved so that the app could tell
 * it not to notify us on close events, this could be removed. It is a global
 * so that cronsync-main can set it for alarm operations. This file does not
 * track alarm setMozMessageHandler messages directly, since they need to
 * acquire wake locks in the event turn the message is received. Since that is a
 * bit complicated, the back-end handles it, since it also knows more about the
 * sync details.
 */
window.appDispatchedMessage = false;

(function() {
  // Holds on to the pending message type that is indicated by
  // mozHasPendingMessage. If it has a value, given by mozHasPendingMessage,
  // then startup is put on hold until it arrives. Once the mozSetMessageHandler
  // for the pending message type is received, this variable is cleared,
  // opening the way for other mozSetMessageHandler messages to be processed.
  // This is only important to track for messages that have UI impact, like
  // inserting cards. Data messages, like alarm are fine to pass through
  // unblocked.
  let pendingUiMessageType = null;

  // There are special tasks, like DOM injection from cache, and startup of the
  // main JS scripts, that should only be done during startup, but once the app
  // has started up, then this file just handles dispatching of messages
  // received via mozSetMessageHandler.
  let startingUp = true;

  // Holds the determination of the entry point type and view that should be
  // used for startup.
  let startupData = {};

  /**
   * startupOnModelLoaded is set to this function if the
   * data_has_enable_account localStorage value is not known. Called eventually by
   * config.js once the model module has been loaded.
   */
  function localOnModelLoaded(model, callback) {
    model.latestOnce('acctsSlice', (acctsSlice) => {
      // At this point, model will have set up 'data_has_enable_account', so the the
      // final view can be set and the rest of the world can start turning.
      // Note that alarm can get kicked off before this is all done,
      // since the worker will have started up and registered to get those
      // messages. It is OK though since not showing any UI. If this case is
      // triggered, it will result in a UI display in that case, but that is OK,
      // it only happens on an app update situation, from cookies to
      // localStorage or some kind of localStorage reset. So a rare event, and
      // does not cause harm, just a bit of extra work in those cases once.
      console.log('localOnModelLoaded called, hasAccount: ' +
                  localStorage.getItem('data_has_enable_account'));

      setDefaultView();
      hydrateHtml(startupData.view);
      window.startupOnModelLoaded = null;
      callback();
    });
  }

  if (!localStorage.getItem('data_has_enable_account')) {
    console.log('data_has_enable_account unknown, asking for model load first');
    window.startupOnModelLoaded = localOnModelLoaded;
  }

  function hasAccount() {
    return localStorage.getItem('data_has_enable_account') === 'yes';
  }

  function setDefaultView() {
    if (hasAccount()) {
      if (!startupData.view) {
        startupData.view = 'message_list';
      }
    } else {
      startupData.view = 'welcome_page';
    }
  }

  // Set up the default view, but if that is not possible to know yet, since
  // the status of hasAccount is unknown, wait for the callback to set it up.
  if (!window.startupOnModelLoaded) {
    setDefaultView();
  }

  startupData.entry = 'default';

  /**
   * Makes sure the message type is wanted, given pendingUiMessageType concerns,
   * and not coming in at a fast rate due to things like double clicks. Only
   * necessary to use if the message is something that would insert cards, and
   * fast entries could mess up card state.
   */
  let lastEntryTime = 0;
  function isUiMessageTypeAllowedEntry(type) {
    // If startup is pending on a message, and this message type is not what is
    // wanted, skip it.
    if (pendingUiMessageType && pendingUiMessageType !== type) {
      console.log('Ignoring message of type: ' + type);
      return false;
    }

    let entryTime = Date.now();

    // This is the right pending startup message, so proceed without checking
    // the entryTime as it is the first one allowed through.
    if (pendingUiMessageType) {
      pendingUiMessageType = null;
    } else {
      // Check for fast incoming messages, like from activity double taps, and
      // ignore them, to avoid messing up the UI startup from double-click taps
      // of activities/notifications that would insert new cards. Only one entry
      // per second.
      if (entryTime > lastEntryTime && entryTime < lastEntryTime + 1000) {
        console.log('email entry gate blocked fast repeated action: ' + type);
        return false;
      }
    }

    lastEntryTime = entryTime;
    return true;
  }

  /**
   * Gets the HTML string from cache, as well as language direction.
   * This method assumes all cookie keys that have pattern
   * /htmlc(\d+)/ are part of the object value. This method could
   * throw given vagaries of cookie cookie storage and encodings.
   * Be prepared.
   */
  function retrieve(id) {

    // let _1 = performance.now();
    let value = localStorage.getItem('html_cache_' + id) || '';
    // console.log('@@@ LOCALSTORAGE GET html_cache: ' +
    // (performance.now() - _1));

    let index, version, lang, langDir, cachedSoftkey;

    // console.log('RETRIEVED: ' + 'html_cache_' + id + ': ' + value);
    index = value.indexOf(':');

    if (index === -1) {
      value = '';
    } else {
      version = value.substring(0, index);
      value = value.substring(index + 1);

      // Version is further subdivided to include lang direction. See email's
      // l10n.js for logic to reset the dir back to the actual language choice
      // if the language direction changes between email invocations.
      let versionParts = version.split(',');
      version = versionParts[0];
      lang = versionParts[1];
      langDir = versionParts[2];
      cachedSoftkey = versionParts[3];
    }

    if (version !== window.HTML_CACHE_VERSION) {
      console.log('Skipping html cache for ' + id + ', out of date. Expected ' +
                  window.HTML_CACHE_VERSION + ' but found ' + version);
      value = '';
    }

    return {
      lang: lang,
      langDir: langDir,
      cachedSoftkey: cachedSoftkey,
      contents: value
    };
  }

  // The evt module is needed to register for 'notification' events that are
  // triggered by other code in the email app (not from the mozSetMessageHandler
  // pathway), but it can be done lazily once the rest of the app has started up
  // and has asked to listen for app messages.
  let evt;

  // Tracks the handlers that are registered via globalOnAppMessage. The
  // handlers are stored in slots that are named for the message types, like
  // 'activity', 'notification'.
  let handlers = {};

  // Holds on to messages that come in via mozSetMessageHandler until there is a
  // handler that has been registred for that message type.
  let handlerQueues = {
    notification: [],
    activity: []
  };

  /**
   * Called by app code. Only expects one listener to be registered for each
   * handler type. This function also assumes that a  `require` loader is
   * available to fetch the 'evt' module. This would not be needed if
   * evt.emit('notification') was  not triggered by the email code.
   * @param  {Object} listener Object whose keys are the handler type names and
   * values are functions that handle that type.
   */
  window.globalOnAppMessage = function(listener) {

    Object.keys(listener).forEach((key) => {
      let fn = handlers[key] = listener[key];
      let queue = handlerQueues[key];
      if (queue.length) {
        handlerQueues[key] = [];
        queue.forEach((argsArray) => {
          fn.apply(undefined, argsArray);
        });
      }
    });

    // Only need to do this wiring once, but globalOnAppMessage could be called
    // multiple times.
    if (!evt) {
      require(['evt'], (ev) => {
        evt = ev;
        evt.on('notification', onNotification);
      });
    }

    return startupData;
  };

  // Attach the hasAccount so that other code can use it and always get the
  // freshest cached value.
  window.globalOnAppMessage.hasAccount = hasAccount;

  function dispatch(type, args) {
    window.appDispatchedMessage = true;
    if (handlers[type]) {
      return handlers[type].apply(undefined, args);
    } else {
      handlerQueues[type].push(args);
    }

    // On the very first dispatch when app open is triggered by a dispatchable
    // event, need to finish bootup now that full startup state is known.
    finishStartup();
  }

  /**
   * Perform requested activity.
   *
   * @param {MozActivityRequestHandler} req activity invocation.
   */
  function onActivityRequest(req) {
    console.log('mozSetMessageHandler: received an activity');
    if (!isUiMessageTypeAllowedEntry('activity')) {
      return req.postError('cancelled');
    }

    // Right now all activity entry points go to compose, but may need to
    // revisited if the activity entry points change.
    if (startingUp) {
      startupData.view = 'compose';
      hydrateHtml(startupData.view);
    }

    dispatch('activity', [req]);
  }

  function onNotification(msg) {
    console.log('mozSetMessageHandler: received a notification');
    // Skip notification events that are not from a notification "click". The
    // system app will also notify this method of any close events for
    // notifications, which are not at all interesting.
    if (!msg.clicked) {
      // If a alarm is waiting right behind this notification message, that sync
      // would will be lost when the application closes. It is an edge case
      // though, and recoverable on the next sync, where trying to be
      // accommodating to it here would add more code complexity, and it would
      // still have a failure window where the app just starts up with a
      // notification, but just after that, after startup is finished but before
      // this function is called, a sync message is queued up. Activities could
      // be dropped too in a similar situation, but we might already drop some
      // due to the fast click gate. The long term fix is to just get a
      // notification system that allows apps to tell it not to call it if just
      // closing a notification.

      // Only close if entry was a notification and no other messages, like a
      // alarm or a UI-based message, have been dispatched.
      if (startupData.entry === 'notification' &&
          !window.appDispatchedMessage) {
        console.log('App only started for notification close, closing app.');
        window.close();
      }
      return;
    }

    // Bail early if notification is ignored. Do this before the notification
    // close() work, so that user has the opportunity to tap on the notification
    // later and still activate that notification flow.
    if (!isUiMessageTypeAllowedEntry('notification')) {
      return;
    }

    // Need to manually get all notifications and close the one that triggered
    // this event due to fallout from 890440 and 966481.
    if (typeof Notification !== 'undefined' && Notification.get) {
      Notification.get().then((notifications) => {
        if (notifications) {
          notifications.some((notification) => {
            // Compare tags, as the tag is based on the account ID and
            // we only have one notification per account. Plus, there
            // is no "id" field on the notification.
            if (notification.tag === msg.tag && notification.close) {
              notification.close();
              return true;
            }
          });
        }
      });
    }

    // Adjust the startupData view as desired by the notification. For upgrade
    // cases where a previous notification from an older version of email
    // used the iconUrl, this just means we will got to the message_list instead
    // of the message_reader for the single email notification case, but that is
    // OK since it is a temporary upgrade issue, and the email will still be
    // seen since it should be top of the list in the message_list.
    let view = msg.data && msg.data.type;
    if (startingUp && view) {
      startupData.view = view;
      hydrateHtml(view);
    }

    // The notification infrastructure does not automatically bring the app to
    // the foreground, so if still hidden, show it now. Ideally this would not
    // use a setTimeout, but it was getting incorrect document.hidden values on
    // startup, where just a bit later the value does seem to be set correctly.
    // The other option was to do this work inside the notification handler in
    // mail_app, but the delay is long enough waiting for that point that the
    // user might be concerned they did not correctly tap the notification.
    setTimeout(() => {
      if (document.hidden && navigator.mozApps) {
        console.log('document was hidden, showing app via mozApps.getSelf');
        navigator.mozApps.getSelf().onsuccess = (event) => {
          let app = event.target.result;
          app.launch();
        };
      }
    }, 300);

    dispatch('notification', [msg.data]);
  }

  let selfNode = document.querySelector('[data-loadsrc]');

  function hydrateHtml(id) {
    let parsedResults = retrieve(id);

    // do not restore cache if language changed
    if (parsedResults.lang !== navigator.language) {
      return;
    }

    if (parsedResults.langDir) {
      document.querySelector('html').setAttribute('dir', parsedResults.langDir);
    }

    let contents = parsedResults.contents;

    // Automatically restore the HTML as soon as module is executed.
    // ASSUMES card node is available (DOMContentLoaded or execution of
    // module after DOM node is in doc)
    let cardsNode = document.getElementById(selfNode.dataset.targetid);

    cardsNode.innerHTML = contents;
    window.startupCacheEventsSent = !!contents;

    // To improve email startup performance, also restore softkeybar node
    // with softkey cache.
    let softkeyHTML = parsedResults.cachedSoftkey;
    if (softkeyHTML && id !== 'compose') {
      window.softkeyHTML = softkeyHTML;
      let softkeyNODE =
          (new DOMParser()).parseFromString(softkeyHTML, 'text/html')
              .activeElement.childNodes[0];
      document.body.appendChild(softkeyNODE);
    }

    if (contents) {
      console.log('Using HTML cache for ' + id);
    }

    if (window.startupCacheEventsSent) {
      window.performance.mark('navigationLoaded');
      window.dispatchEvent(new CustomEvent('moz-chrome-dom-loaded'));
      window.performance.mark('visuallyLoaded');
      window.dispatchEvent(new CustomEvent('moz-app-visually-complete'));
    }
  }

  function finishStartup() {
    // This can be called multiple times due to pendingUiMessageType listeners
    // so only do the work once.
    if (!startingUp) {
      return;
    }

    let scriptNode = document.createElement('script'),
        loader = selfNode.dataset.loader,
        loadSrc = selfNode.dataset.loadsrc;

    if (loader) {
      scriptNode.setAttribute('data-main', loadSrc);
      scriptNode.src = loader;
    } else {
      scriptNode.src = loadSrc;
    }

    document.head.appendChild(scriptNode);

    startingUp = false;
  }

  // mozHasPendingMessage seems like it can only be called once per message
  // type, so only asking once. If we have both an activity or a notification
  // coming in, the activity should win since it is part of a larger user action
  // besides just email, and expects to get some callbacks.
  if (navigator.mozHasPendingMessage) {
    if (navigator.mozHasPendingMessage('activity')) {
      pendingUiMessageType = 'activity';
    } else if (navigator.mozHasPendingMessage('notification')) {
      pendingUiMessageType = 'notification';
    }

    if (pendingUiMessageType) {
      startupData.entry = pendingUiMessageType;
    } else if (navigator.mozHasPendingMessage('alarm')) {
      // While alarm is not important for the pendingUiMessageType
      // gateway, it still should be indicated that the entry point was not the
      // default entry point, so that the UI is not fully started if this is a
      // background sync.
      startupData.entry = 'alarm';
    } else if (navigator.mozHasPendingMessage('request-sync')) {
      // Be nice and consume the message so that request-sync feels like it
      // completed its mission, but ignore the actual message.
      if (navigator.mozSetMessageHandler) {
        navigator.mozSetMessageHandler('request-sync', (e) => {
          console.log('Received legacy request-sync message, ignoring.');
        });
      }

      // Legacy request-sync trigger. Just clear all request-sync tasks, and
      // allow the UI to go to a normal view this time. When back end starts up
      // it will ensure the sync alarms are set properly for the next sync, so
      // in this legacy case we will just miss one sync pass.
      let navSync = navigator.sync;
      if (navSync) {
        navSync.registrations().then((regs) => {
          regs.forEach((reg) => {
            console.log('Unregistering legacy request sync...');
            navSync.unregister(reg.task);
            console.log('Unregister done!');
          });
        }, (err) => {
          console.error('navigator.sync.registrations failed: ', err);
        });
      }
    }
  }

  if ('mozSetMessageHandler' in navigator) {
    navigator.mozSetMessageHandler('notification', onNotification);
    navigator.mozSetMessageHandler('activity', onActivityRequest);
  } else {
    console.warn('mozSetMessageHandler not available. No notifications, ' +
                 'activities or syncs.');
  }

  document.body.classList.toggle('large-text', navigator.largeTextEnabled);
  if (window.startupOnModelLoaded) {
    finishStartup();
  } else if (startupData.entry === 'default' ||
             startupData.entry === 'alarm') {
    hydrateHtml(startupData.view);
    finishStartup();
  }
}());

