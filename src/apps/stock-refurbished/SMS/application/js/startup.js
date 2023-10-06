/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/*global ActivityHandler, ThreadUI, ThreadListUI, MessageManager,
         Settings, LazyLoader, TimeHeaders, Information, SilentSms,
         PerformanceTestingHelper, App, Navigation, EventDispatcher,
         LocalizationHelper,
         InterInstanceEventDispatcher
*/

let Startup = {
  _lazyLoadScripts: [
    '/shared/js/settings_listener.js',
    '/shared/js/mime_mapper.js',
    '/shared/js/notification_helper.js',
    '/shared/js/option_menu.js',
    '/shared/js/gesture_detector.js',
    '/shared/js/settings_url.js',
    '/shared/js/mobile_operator.js',
    '/shared/js/image_utils.js',
    '/shared/js/dialer/telephony_helper.js',
    '/shared/js/aml/aml.js',
    'js/waiting_screen.js',
    'js/errors.js',
    'js/dialog.js',
    'js/error_dialog.js',
    'js/link_helper.js',
    'js/contact_renderer.js',
    'js/activity_picker.js',
    'js/information.js',
    'js/shared_components.js',
    'js/task_runner.js',
    'js/silent_sms.js',
    'js/recipients.js',
    'js/attachment.js',
    'js/attachment_renderer.js',
    'js/attachment_menu.js',
    'js/thread_ui.js',
    'js/searchMessageUI.js',
    'js/attachmentMessageUI.js',
    'js/subject_composer.js',
    'js/compose.js',
    'js/wbmp.js',
    'js/smil.js',
    'js/notify.js',
    'js/activity_handler.js',
    'js/localization_helper.js',
    'js/confirm_dialog_helper.js',
    'js/input_dialog_helper.js',
    'js/check_dialog_helper.js'
  ],
  _cacheLazyLoadScripts: [
    'shared/js/date_time_helper.js',
    'shared/js/template.js',
    'shared/js/performance_testing_helper.js',
    'shared/js/async_storage.js',
    'shared/js/sticky_header.js',
    'shared/js/contact_photo_helper.js',
    'shared/js/fb/fb_request.js',
    'shared/js/fb/fb_data_reader.js',
    'shared/js/fb/fb_reader_utils.js',
    'js/navigation.js',
    'js/iac/event_dispatcher.js',
    'js/time_headers.js',
    'js/contacts.js',
    'js/drafts.js',
    'js/threads.js',
    'js/utils.js',
    'js/thread_list_ui.js',
    'js/settings.js',
    'js/message_manager.js',
    'js/app.js',
    'js/cache.js',
    'shared/js/custom_dialog.js',
    'js/navigation_handler.js',
    'shared/js/toaster.js'
  ],
  useCache: false,
  lazyLoadTimeOut: 200,
  isActivity: false,
  messageReceive: false,
  hasGroup: false, // default group message is removed.
  firstDraftCheck: false,

  _lazyLoadInit: function() {
    let lazyLoadPromise = LazyLoader.load(Startup._lazyLoadScripts).then(() => {
      LocalizationHelper.init();

      InterInstanceEventDispatcher.connect();

      // dispatch moz-content-interactive when all the modules initialized
      SilentSms.init();
      ActivityHandler.init();

      // Init UI Managers
      TimeHeaders.init();
      ThreadUI.init();
      Information.initDefaultViews();

      // Dispatch post-initialize event for continuing the pending action
      Startup.emit('post-initialize');
      window.performance.mark('contentInteractive');
      window.dispatchEvent(new CustomEvent('moz-content-interactive'));

      // Fetch mmsSizeLimitation and max concat
      Settings.init();
      SearchMessageUI.init();
      AttachmentMessageUI.init();

      window.performance.mark('objectsInitEnd');
      PerformanceTestingHelper.dispatch('objects-init-finished');
    });
    Startup._initHeaders();
    return lazyLoadPromise;
  },

  _initHeaders: function() {
    let headers = document.querySelectorAll('gaia-header[no-font-fit]');
    for (let i = 0, l = headers.length; i < l; i++) {
      headers[i].removeAttribute('no-font-fit');
    }
  },

  /**
  * We wait for the DOMContentLoaded event in the event sequence. After we
  * loaded the first panel of threads, we lazy load all non-critical JS files.
  * As a result, if the 'load' event was not sent yet, this will delay it even
  * more until all these non-critical JS files are loaded. This is fine.
  */
  init: function() {
    function initializeDefaultPanel(firstPageLoadedCallback) {
      Navigation.off('navigated', initializeDefaultPanel);
      window.dispatchEvent(new CustomEvent('moz-app-cache-complete'));

      ThreadListUI.init();
      ThreadListUI.renderThreads(firstPageLoadedCallback).then(() => {
        window.performance.mark('fullyLoaded');
        window.dispatchEvent(new CustomEvent('moz-app-loaded'));
        App.setReady();
        Startup.useCache = false;
      });
    }

    function cacheLazyload(callback) {
      LazyLoader.load(Startup._cacheLazyLoadScripts).then(function () {
        callback();
      });
    }

    let loaded = function() {
      window.removeEventListener('DOMContentLoaded', loaded);

      window.addEventListener('largetextenabledchanged', () => {
        document.body.classList.toggle('large-text', navigator.largeTextEnabled);
      });
      document.body.classList.toggle('large-text', navigator.largeTextEnabled);

      window.performance.mark('navigationLoaded');
      window.dispatchEvent(new CustomEvent('moz-chrome-dom-loaded'));

      setTimeout(function() {
        window.performance.mark('visuallyLoaded');
        window.dispatchEvent(new CustomEvent('moz-app-visually-complete'));
        cacheLazyload(function() {
          window.addEventListener('mapLoaded', function navigationMapLoaded() {
            window.removeEventListener('mapLoaded', navigationMapLoaded);
            MessageManager.init();
            Navigation.init();

            // If initial panel is default one and app isn't run from notification,
            // then just navigate to it, otherwise we can delay default panel
            // initialization until we navigate to requested non-default panel.
            if (Navigation.isDefaultPanel() &&
                !navigator.mozHasPendingMessage('notification')) {
              Navigation.toDefaultPanel();
              initializeDefaultPanel(Startup._lazyLoadInit);
            } else {
              Navigation.on('navigated', initializeDefaultPanel);
              Startup._lazyLoadInit();
            }

            // dispatch chrome-interactive when thread list related modules
            // initialized
            window.performance.mark('navigationInteractive');
            window.dispatchEvent(new CustomEvent('moz-chrome-interactive'));
          });
        });
      }, Startup.lazyLoadTimeOut);
    }.bind(this);

    Startup.messageReceive =
      window.navigator.mozHasPendingMessage('sms-received') ||
      window.navigator.mozHasPendingMessage('sms-delivery-success');
    MessageCacheRestore.hydrateHtml('threads-container');
    window.addEventListener('DOMContentLoaded', loaded);
  }
};

EventDispatcher.mixin(Startup).init();
