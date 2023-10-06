'use strict';

(function() {
/*
 * This emergency callback mode manager is for:
 * - Initialize the manager if network type is cdma and regist an event handler
 *   for emergency callback mode change.
 * - Display a notification to showing the system is entered the callback
 *    mode with count down timer.
 * - Popup a dialog for user to notify the mode will block data network and
 *   let user decide callback mode should exit or not.
 *
 */

  var EmergencyCallbackManager = function(core) {
    if (core && core.mobileConnections) {
      this._conn = core.mobileConnections[0];
    }
  };
  // XXX: Migrate to ES6 BaseModule
  EmergencyCallbackManager.EVENTS = ['__keydown'];
  BaseModule.create(EmergencyCallbackManager, {
    name: 'EmergencyCallbackManager',
    timer: 0,
    timeoutController: null,
    TOASTER_TIMEOUT: 2000,
    EVENT_PREFIX: 'emergencycallback',

    notification: null,
    message: null,
    toaster: null,
    toasterMessage: null,

    initDOM: function() {
      if (this.notification) {
        return;
      }
      // Dom elements
      this.notification =
        document.getElementById('emergency-callback-notification');
      if (!this.notification) {
        return;
      }
      Service.request('SoftKeyStore:register', {center: 'icon=ok'}, this.notification);
      this.message = this.notification.querySelector('.title-container');
      this.notificationTimer = this.notification.querySelector('.timer');

      this.toaster = document.getElementById('emergency-callback-toaster');
      this.toasterMessage = this.toaster.querySelector('.message');
      this.toasterTimer = this.toaster.querySelector('.timer');

      this.notification.addEventListener('keydown', this);
    },

    _handle_keydown(evt) {
      switch (evt.key) {
        case 'Enter':
          this.notificationClicked();
          break;
      }
    },

    _start: function() {
      this.initDOM();
      // Event handler
      this._conn.addEventListener('emergencycbmodechange',
        this.onEmergencyCbModeChange.bind(this));
    },

    exitEmergencyCbMode: function() {
      this._conn.exitEmergencyCbMode();
    },

    notificationClicked: function() {
      this.showEmergencyCbPrompt();
      Service.request('NotificationView:close');
    },

    toasterClicked: function() {
      this.showEmergencyCbPrompt();
      this.toaster.classList.remove('displayed');
      this.toaster.hidden = true;
    },

    showEmergencyCbPrompt: function() {
      Service.request('DialogService:show', {
        header: 'emergency-callback-mode',
        content: 'emergency-callback-message',
        onOk: this.exitEmergencyCbMode.bind(this),
        type: 'confirm'
      });
    },

    displayNotificationAndToaster: function() {
      this.displayNotificationIfHidden();
      this.toasterTimer.textContent = this.timerString;
      this.toaster.classList.add('displayed');
      this.toaster.hidden = false;
      setTimeout(function waitToHide() {
        this.toaster.classList.remove('displayed');
        this.toaster.hidden = true;
      }.bind(this), this.TOASTER_TIMEOUT);
    },

    hideNotificationIfDisplayed: function() {
      if (!this.notification.classList.contains('hidden')) {
        this.notification.classList.add('hidden');
        Service.request('hideEmcbNotification');
        this.publish('statechanged', false);
      }
    },

    displayNotificationIfHidden: function() {
      if (this.notification.classList.contains('hidden')) {
        this.notification.classList.remove('hidden');
        Service.request('showEmcbNotification');
        this.publish('statechanged', true);
      }
    },

    updateTimer: function() {
      this.timer -= 1000;
      if (this.timer < 0) {
        window.clearInterval(this.timeoutController);
        this.timeoutController = null;
        return;
      }

      this.notificationTimer.textContent = this.timerString;
    },

    onDataError: function(evt) {
      // TODO: We shold be able to confirm the error is caused by
      //       emergency callback mode before showing prompt.
      this.showEmergencyCbPrompt();
    },

    onEmergencyCbModeChange: function(evt) {
      var active = evt.active;
      if (active) {
        if (this.timeoutController) {
          window.clearInterval(this.timeoutController);
        }
        this.timer = evt.timeoutMs;
        this.displayNotificationAndToaster();
        this.timeoutController =
          window.setInterval(this.updateTimer.bind(this), 1000);
        this._conn.ondataerror = this.onDataError.bind(this);
      } else {
        this.hideNotificationIfDisplayed();
        window.clearInterval(this.timeoutController);
        this.timeoutController = null;
        this._conn.ondataerror = null;
      }
    }
  }, {
    timerString: {
      configurable: false,
      get: function() {
        var totalSec = this.timer / 1000;
        var min = Math.floor(totalSec / 60);
        var secString = (totalSec % 60).toString();
        var sec = secString.length > 1 ? secString : '0' + secString;
        return (min + ':' + sec);
      }
    }
  });
}());
