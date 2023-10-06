/* global BaseModule, Service, ScreenManager */
'use strict';

(function() {
  var SuplHandler = function() {};

  SuplHandler.EVENTS = [
    'mozChromeEvent'
  ];

  // SUPL NI (Network Initiated) is initiated by cellular network and notify
  // system app via AGPS HAL. The AGPS HAL uses lazy initialization and wouldn't
  // create any instance until any of web apps/pages access navigator.geolocation.
  // The following statement would trigger Geolocation constructor in case
  // AGPS HAL hasn't been initialized.
  navigator.geolocation;

  BaseModule.create(SuplHandler, {
    DEBUG: true,
    name: 'SuplHandler',

    notify: function(detail) {
      this.debug('Notify: ' + detail.data);
      var _ = navigator.mozL10n.get;

      var customMessage = this.formatData(detail.data);

      var notification = new Notification(_('supl-notification-title'), {
        body: _('supl-notification-message'),
        icon: 'style/icons/system_84.png',
        tag: 'supl-notification',
        mozbehavior: {
          showOnlyOnce: true
        }
      });
      notification.addEventListener('click', () => {
        notification.close();
        Service.request('DialogService:show', {
          header: _('supl-notification-title'),
          content: _('supl-notification-message') +
                   (this.hasCustomMessage(detail.data) ? (' ' + _('supl-more-message', customMessage)) : ''),
          type: 'alert',
          translated: true
        });
      });
    },

    formatData: function(data) {
      var array = data.split(',');
      var object = {
        vid: array[0],
        id: array[2],
        message: array[1]
      };
      return object;
    },

    verify: function(detail) {
      this.debug('Verify: ' + detail.data);

      var _ = navigator.mozL10n.get;

      if (this._pendingVerification) {
        this.debug('Cancelled due to previous verification is pending.');
        return;
      }

      this._pendingVerification = detail.data;

      if (Service.query('locked')) {
        // Trigger a notification first if screen is being locked, otherwise
        // the user is no way to notice the dialog.
        var notification = new Notification(_('supl-verification-title'), {
          body: _('supl-verification-message-for-notification'),
          icon: 'style/icons/system.png',
          tag: 'supl-verification',
          mozbehavior: {
            showOnlyOnce: true
          }
        });
        notification.addEventListener('click', () => {
          this._pendingNotification = undefined;
          notification.close();
          this.showDialog(detail);
        });
        this._pendingNotification = notification;
      } else {
        this.showDialog(detail);
      }
    },

    hasCustomMessage: function(data) {
      var object = this.formatData(data);
      return (data.message + data.id) !== '';
    },

    showDialog: function(detail) {
      this.debug('showDialog: ' + detail.data);
      var _ = navigator.mozL10n.get;
      // Turn screen on in case device is sleeping and lockscreen is disabled.
      ScreenManager.turnScreenOn();
      var customMessage = this.formatData(this._pendingVerification);
      Service.request('DialogService:show', {
        header: _('supl-verification-title'),
        content: _('supl-verification-message') +
                (this.hasCustomMessage(this._pendingVerification) ? (' ' + _('supl-more-message', customMessage)) : ''),
        ok: 'supl-verification-confirm',
        onOk: this.sendChoice.bind(this, customMessage, true),
        cancel: 'supl-verification-cancel',
        onCancel: this.sendChoice.bind(this, customMessage, false),
        translated: true,
        type: 'confirm'
      });
    },

    sendChoice: function(data, value) {
      var currentData = this.formatData(this._pendingVerification);
      if (!currentData || data.vid !== currentData.vid) {
        return;
      }

      this.debug('Choice: ' + data.vid + ', ' + value);

      // Send the choice back via mozSettings based on Gecko's design. Set it a
      // postive id if user allows the action or set it to be negative if not.
      navigator.mozSettings.createLock().set({
        'supl.verification.choice': data.vid * (value ? 1 : -1)
      });

      this._pendingVerification = undefined;
    },

    timeout: function(detail) {
      this.debug('timeout: ' + detail.data);
      var data = detail.data;
      var verifyId = this.formatData(data).vid;
      var currentData = this.formatData(this._pendingVerification);
      if (verifyId && currentData.vid == verifyId) {
        this._pendingVerification = undefined;
        if (this._pendingNotification) {
          this._pendingNotification.close();
          this._pendingNotification = undefined;
        } else {
          Service.request('DialogService:hide');
        }
      }
    },

    _start: function() {
      this._pendingNotification = undefined;
      this._pendingVerification = undefined;
    },

    _stop: function() {
      if (!this._pendingVerification) {
        return;
      }
      this.timeout(this._pendingVerification);
    },

    _handle_mozChromeEvent: function(evt) {
      var detail = evt.detail;

      switch(detail.type) {
        case 'supl-notification':
          this.notify(detail);
          break;
        case 'supl-verification':
          this.verify(detail);
          break;
        case 'supl-verification-timeout':
          this.timeout(detail);
          break;
      }
    }
  });
}());