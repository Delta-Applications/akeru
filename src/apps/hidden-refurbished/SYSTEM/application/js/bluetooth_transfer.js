/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* API Summary:
   stopSendingFile(in DOMString aDeviceAddress);
   confirmReceivingFile(in DOMString aDeviceAddress, in bool aConfirmation); */
'use strict';
/* global CustomDialog, NfcHandoverManager, MimeMapper, uuid,
          MozActivity, NfcHandoverManager*/
/* exported BluetoothTransfer */
(function(exports) {
var BluetoothTransfer = {
  // The first-in-first-out queue maintain each scheduled sending task.
  // Each element is a object for scheduled sending tasks.
  _sendingFilesQueue: [],
  _debug: true,
  _started: false,
  _timeout: null,
  _isStorageAvailable: true,
  _isUserCanceled: false,
  // Auto cancel current file transfer event delay time
  _delayTime: 60000,

  get _deviceStorage() {
    return navigator.getDeviceStorage('sdcard');
  },

  init: function bt_init() {
    // Bind message handler for sending files from Bluetooth app
    window.addEventListener('iac-bluetoothTransfercomms',
      this._onFilesSending.bind(this)
    );

    // Bind message handler for transferring file callback
    navigator.mozSetMessageHandler('bluetooth-opp-receiving-file-confirmation',
      this.showReceivePrompt.bind(this)
    );

    // Listen to 'bluetooth-opp-transfer-start' from bluetooth.js
    window.addEventListener('bluetooth-opp-transfer-start',
      this._onUpdateProgress.bind(this, 'start')
    );

    navigator.mozSetMessageHandler('bluetooth-opp-update-progress',
      this._onUpdateProgress.bind(this, 'progress')
    );

    // Listen to 'bluetooth-opp-transfer-complete' from bluetooth.js
    window.addEventListener('bluetooth-opp-transfer-complete',
      this._onTransferComplete.bind(this)
    );
  },

  getDeviceName: function bt_getDeviceName(address) {
    return new Promise(function(resolve) {
      var _ = navigator.mozL10n.get;
      var adapter = Service.query('Bluetooth.getAdapter');
      if (adapter == null) {
        var msg = 'Since cannot get Bluetooth adapter, ' +
                  'resolve with an unknown device.';
        this.debug(msg);
        resolve(_('unknown-device'));
      }
      var self = this;
      // Service Class Name: OBEXObjectPush, UUID: 0x1105
      // Specification: Object Push Profile (OPP)
      //                NOTE: Used as both Service Class Identifier and Profile.
      // Allowed Usage: Service Class/Profile
      // https://www.bluetooth.org/en-us/specification/assigned-numbers/
      // service-discovery
      var serviceUuid = '0x1105';
      var req = adapter.getConnectedDevices(serviceUuid);
      req.onsuccess = function bt_gotConnectedDevices() {
        if (req.result) {
          var connectedList = req.result;
          var length = connectedList.length;
          for (var i = 0; i < length; i++) {
            if (connectedList[i].address == address) {
              resolve(connectedList[i].name);
            }
          }
        } else {
          resolve(_('unknown-device'));
        }
      };
      req.onerror = function() {
        var msg = 'Can not check is device connected from adapter.';
        self.debug(msg);
        resolve(_('unknown-device'));
      };
    }.bind(this));
  },

  debug: function bt_debug(msg) {
    if (!this._debug) {
      return;
    }

    console.log('[System Bluetooth Transfer]: ' + msg);
  },

  _clearTimeout: function bt_clearTimeout() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  },

  humanizeSize: function bt_humanizeSize(bytes) {
    var _ = navigator.mozL10n.get;
    var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var size, e;
    if (bytes) {
      e = Math.floor(Math.log(bytes) / Math.log(1024));
      size = (bytes / Math.pow(1024, e)).toFixed(2);
    } else {
      e = 0;
      size = '0';
    }
    return _('fileSize', {
      size: size,
      unit: _('byteUnit-' + units[e])
    });
  },

  _onFilesSending: function bt__onFilesSending(evt) {
    // Push sending files request in queue
    var sendingFilesSchedule = evt.detail;
    this._sendingFilesQueue.push(sendingFilesSchedule);
    var msg = 'push sending files request in queue, queued length = ' +
              this._sendingFilesQueue.length;
    this.debug(msg);
  },

  showReceivePrompt: function bt_showReceivePrompt(evt) {
    var address = evt.address;
    var fileName = evt.fileName;
    var fileSize = this.humanizeSize(evt.fileLength);

    var _ = navigator.mozL10n.get;

    // Don't receive the file at the attention screens and passcode lockscreen.
    if (Service.query('locked') ||
        attentionWindowManager.hasActiveWindow()) {
      this.declineReceive(address);
      return;
    }

    this._timeout = setTimeout(() => {
      this.declineReceive(address);
      this.debug('device don\'t accept the file and timeout occurred.');
    }, this._delayTime);

    this.getDeviceName(address).then((deviceName) => {
      Service.request('NotificationView:close');
      Service.request('DialogService:show', {
        header: _('acceptFileTransfer'),
        content: _('requestToReceive',
          {
            deviceName: deviceName,
            fileName: fileName,
            fileSize: fileSize
          }
        ),
        ok: 'accept',
        type: 'confirm',
        onBack: this.declineReceive.bind(this, address),
        onCancel: this.declineReceive.bind(this, address),
        onOk: this.acceptReceive.bind(this, evt),
        translated: true
      });
      this.playNotificationTone();
    });
  },

  playNotificationTone: function() {
    var ringtonePlayer = new Audio();
    var telephony = window.navigator.mozTelephony;

    ringtonePlayer.src = 'shared/resources/media/notifications/Calendar_1.opus';
    if (telephony && telephony.active) {
      ringtonePlayer.mozAudioChannelType = 'telephony';
      ringtonePlayer.volume = 0.3;
    } else {
      ringtonePlayer.mozAudioChannelType = 'notification';
    }
    ringtonePlayer.play();
    window.setTimeout(() => {
      ringtonePlayer.pause();
      ringtonePlayer.removeAttribute('src');
      ringtonePlayer.load();
    }, 2000);
  },

  declineReceive: function bt_declineReceive(address) {
    this._clearTimeout();
    CustomDialog.hide();
    var adapter = Service.query('Bluetooth.getAdapter');
    if (adapter != null) {
      adapter.confirmReceivingFile(address, false);
    } else {
      var msg = 'Cannot get adapter from system Bluetooth monitor.';
      this.debug(msg);
    }
  },

  acceptReceive: function bt_acceptReceive(evt) {
    this._clearTimeout();
    CustomDialog.hide();
    // Check storage is available or not before confirm receiving file
    var address = evt.address;
    var fileSize = evt.fileLength;
    var self = this;
    this.checkStorageSpace(fileSize,
      function checkStorageSpaceComplete(isStorageAvailable, errorMessage) {
        var adapter = Service.query('Bluetooth.getAdapter');
        var option = (isStorageAvailable) ? true : false;
        if (adapter) {
          self._isStorageAvailable = option;
          adapter.confirmReceivingFile(address, option);
        } else {
          var msg = 'Cannot get adapter from system Bluetooth monitor.';
          self.debug(msg);
        }
        // Storage is not available, then pop out a prompt with the reason
        if (!isStorageAvailable) {
          self.showStorageUnavaliablePrompt(errorMessage);
        }
    });
  },

  showStorageUnavaliablePrompt: function bt_showStorageUnavaliablePrompt(msg) {
    var body = navigator.mozL10n.get(msg);
    Service.request('DialogService:show', {
      title: navigator.mozL10n.get('cannotReceiveFile'),
      content: body,
      translated: true,
      type: 'alert'
    });
  },

  checkStorageSpace: function bt_checkStorageSpace(fileSize, callback) {
    if (!callback) {
      return;
    }

    var storage = this._deviceStorage;

    var availreq = storage.available();
    availreq.onsuccess = function(e) {
      switch (availreq.result) {
      case 'available':
        // skip down to the code below
        break;
      case 'unavailable':
        callback(false, 'sdcard-not-exist2');
        return;
      case 'shared':
        callback(false, 'sdcard-in-use');
        return;
      default:
        callback(false, 'unknown-error');
        return;
      }

      // If we get here, then the sdcard is available, so we need to find out
      // if there is enough free space on it
      var freereq = storage.freeSpace();
      freereq.onsuccess = function() {
        if (freereq.result >= fileSize) {
          callback(true, '');
        } else {
          callback(false, 'sdcard-no-space2');
        }
      };
      freereq.onerror = function() {
        callback(false, 'cannotGetStorageState');
      };
    };

    availreq.onerror = function(e) {
      callback(false, 'cannotGetStorageState');
    };
  },

  get isSendFileQueueEmpty() {
    return this._sendingFilesQueue.length === 0;
  },

  get isFileTransferInProgress() {
    var jobs = document.querySelectorAll('[type="bluetooth-notification"]');
    return jobs.length > 0;
  },

  sendFileViaHandover: function bt_sendFileViaHandover(mac, blob) {
    var adapter = Service.query('Bluetooth.getAdapter');
    if (adapter != null) {
      var sendingFilesSchedule = {
        viaHandover: true,
        numberOfFiles: 1,
        numSuccessful: 0,
        numUnsuccessful: 0
      };
      this._onFilesSending({detail: sendingFilesSchedule});
      // XXX: Bug 915602 - [Bluetooth] Call sendFile api will crash
      // the system while device is just paired.
      // The paired device is ready to send file.
      // Since above issue is existed, we use a setTimeout with 3 secs delay
      var waitConnectionReadyTimeoutTime = 3000;
      setTimeout(function() {
        adapter.sendFile(mac, blob);
      }, waitConnectionReadyTimeoutTime);
    } else {
      var msg = 'Cannot get adapter from system Bluetooth monitor.';
      this.debug(msg);
    }
  },

  _onUpdateProgress: function bt__onUpdateProgress(mode, evt) {
    switch (mode) {
      case 'start':
        this._started = true;
        if (!this._isUserCanceled) {
          this.updateProgress(evt.detail.transferInfo);
          this._timeout = setTimeout(() => {
            this.cancelTransfer(evt.detail.transferInfo.address);
            this.debug('opp\'s device don\'t accept the file and timeout occurred.');
          }, this._delayTime);
        }
        break;
      case 'progress':
        if (this._started) {
          let perm = window.navigator.mozPermissionSettings.get(
            'desktop-notification',
            'app://bluetooth.gaiamobile.org/manifest.webapp',
            'app://bluetooth.gaiamobile.org',
            false
          );
          if (perm === 'allow') {
            Service.request('SystemToaster:show', {
              text: navigator.mozL10n.get('transfer-has-started-toast')
            });
          }
          this._started = false;
        }
        this._clearTimeout();
        this.updateProgress(evt);
        break;
    }
  },

  updateProgress: function bt_updateProgress(evt) {
    let perm = window.navigator.mozPermissionSettings.get(
      'desktop-notification',
      'app://bluetooth.gaiamobile.org/manifest.webapp',
      'app://bluetooth.gaiamobile.org',
      false
    );
    if (perm === 'deny') {
      return;
    }
    var _ = navigator.mozL10n.get;
    var info = {
      id: evt.address,
      title: this._started ? _('transfer-has-started-title') : (evt.received ? _('bluetooth-receiving-progress') : _('bluetooth-sending-progress')),
      icon: this._started ? 'style/bluetooth_transfer/images/transfer.png' : 'icon=bluetooth-transfer-circle',
      type: 'bluetooth-notification',
      noNotify: true,
      callback: () => {
        this.showStopTransferPrompt(evt.address);
      },
      dismissable: false,
      text : this._started ? _('transfer-has-started-description') : Math.ceil(100 * (evt.processedLength / evt.fileLength)) + '%',
      progress: this._started ? null : Math.ceil(100 * (evt.processedLength / evt.fileLength)),
      ignoreTimestamp: true,
      sizeText: this._started ? '' : _('partialResult', {
        partial: this.humanizeSize(evt.processedLength),
        total: this.humanizeSize(evt.fileLength)
      })
    };
    if (this._started && !evt.received) {
      Service.request('SystemToaster:show', info);
    }
    Service.request('NotificationStore:add', info);
  },

  cancelTransfer: function bt_cancelTransfer(address) {
    this._clearTimeout();
    var adapter = Service.query('Bluetooth.getAdapter');
    if (adapter != null) {
      this._isUserCanceled = true;
      adapter.stopSendingFile(address);
    } else {
      var msg = 'Cannot get adapter from system Bluetooth monitor.';
      this.debug(msg);
    }
  },

  showStopTransferPrompt: function bt_showStopTransferPrompt(address) {
    var _ = navigator.mozL10n.get;
    Service.request('DialogService:show', {
      header: _('stopTransferTitle'),
      content: _('stopTransferContent'),
      ok: 'stop',
      type: 'confirm',
      onOk: this.cancelTransfer.bind(this, address),
      translated: true
    });
  },

  cleanNotifications: function(address) {
    Notification.get().then(function(notifications) {
      if (notifications) {
        notifications.forEach(function(notification) {
          // Compare tags, as the tag is based on the "pairing-request" and
          // we only have one notification for the request. Plus, there
          // is no "id" field on the notification.
          if (notification.tag === address &&
              notification.close) {
              notification.close();
          }
        });
      }
    });
  },

  _onTransferComplete: function bt__onTransferComplete(evt) {
    this._clearTimeout();
    var transferInfo = evt.detail.transferInfo;

    // Remove transferring progress
    Service.request('NotificationStore:remove', transferInfo.address);
    var icon = 'style/bluetooth_transfer/images/icon_bluetooth.png';
    var _ = navigator.mozL10n.get;

    // Show notification
    var nData = {
      title: null,
      icon: icon,
      data: null,
      inoperable: true,
      notificationId: uuid()
    };

    var bluetoothSize = null;
    if (transferInfo.success === true) {
      // Received file can be opened only
      bluetoothSize = this.humanizeSize(transferInfo.fileLength);
      if (transferInfo.received) {
        nData.title = _('transferFinished-receivedSuccessful-title');
        nData.inoperable = false;
      } else {
        nData.title = _('transferFinished-sentSuccessful-title');
      }
    } else {
      //if timeout lead failed, hide the dialog
      //if storage is no memory, don't hide the alert dialog
      bluetoothSize = this.humanizeSize(false);
      if (this._isStorageAvailable) {
        Service.request('DialogService:hide');
      }
      nData.title = _('transferFinished-failed-title');
    }
    nData.data = {
      bluetoothSize: bluetoothSize
    };

    this.cleanNotifications(transferInfo.address);


    var perm = window.navigator.mozPermissionSettings.get(
      'desktop-notification',
      'app://bluetooth.gaiamobile.org/manifest.webapp',
      'app://bluetooth.gaiamobile.org',
      false
    );
    if (perm === 'deny') {
      return;
    }
    var notification = Service.request('NotificationStore:add', {
      id: nData.notificationId,
      icon: nData.icon,
      title: nData.title,
      type: 'desktop-notification',
      data: {
        bluetoothSize: bluetoothSize
      },
      callback: () => {
        // Received file can be opened only
        if (transferInfo.success === true && transferInfo.received) {
          this.openReceivedFile(transferInfo);
          Service.request('NotificationStore:remove', nData.notificationId);
        }
      },
      inoperable: nData.inoperable,
      //data: nData.data,  // This removed in the bluetooth v2.5.1 spec
      text: transferInfo.fileName ? transferInfo.fileName : _('unknown-file')
    });


    var viaHandover = false;
    if (this._sendingFilesQueue.length > 0) {
      viaHandover = this._sendingFilesQueue[0].viaHandover || false;
    }

    // Have a report notification for sending multiple files.
    this.summarizeSentFilesReport(transferInfo);

    // Inform NfcHandoverManager that the transfer completed
    var details = {received: transferInfo.received,
                   success: transferInfo.success,
                   viaHandover: viaHandover};
    NfcHandoverManager.transferComplete(details);
  },

  summarizeSentFilesReport: function bt_summarizeSentFilesReport(transferInfo) {
    // Ignore received files
    if (transferInfo.received) {
      return;
    }

    // Consumer: System app consume each sending file request from Bluetooth app
    var msg = 'remove the finished sending task from queue, queue length = ';
    var successful = transferInfo.success;
    var sendingFilesSchedule = this._sendingFilesQueue[0];
    var numberOfFiles = sendingFilesSchedule.numberOfFiles;
    if (numberOfFiles == 1) { // The scheduled task is for sent one file only.
      // We don't need to summarize a report for sent one file only.
      // Remove the finished sending task from the queue
      this._sendingFilesQueue.shift();
      this._isUserCanceled = false;
      msg += this._sendingFilesQueue.length;
      this.debug(msg);
    } else { // The scheduled task is for sent multiple files.
      // Create a report in notification.
      // Record each transferring report.
      if (successful) {
        this._sendingFilesQueue[0].numSuccessful++;
      } else {
        this._sendingFilesQueue[0].numUnsuccessful++;
      }

      var numSuccessful = this._sendingFilesQueue[0].numSuccessful;
      var numUnsuccessful = this._sendingFilesQueue[0].numUnsuccessful;
      if ((numSuccessful + numUnsuccessful) == numberOfFiles) {
        let icon = 'style/bluetooth_transfer/images/icon_bluetooth.png';
        let _ = navigator.mozL10n.get;

        Service.request('NotificationStore:add', {
          id: uuid(),
          icon: icon,
          title: _('transferReport-title'),
          type: 'desktop-notification',

          inoperable: true,
          text: _('transferReport-description', {
              numSuccessful: numSuccessful,
              numUnsuccessful: numUnsuccessful
            })
        });

        // Remove the finished sending task from the queue
        this._sendingFilesQueue.shift();
        this._isUserCanceled = false;
        msg += this._sendingFilesQueue.length;
        this.debug(msg);
      }
    }
  },

  openReceivedFile: function bt_openReceivedFile(evt) {
    // Launch the gallery with an open activity to view this specific photo
    // XXX: Bug 897434 - Save received/downloaded files in one specific folder
    // with meaningful path and filename
    var filePath = 'downloads/Bluetooth/' + evt.fileName;
    var contentType = evt.contentType;
    var storageType = 'sdcard';
    var self = this;
    var storage = navigator.getDeviceStorage(storageType);
    var getreq = storage.get(filePath);

    getreq.onerror = function() {
      var msg = 'failed to get file:' +
                filePath + getreq.error.name +
                getreq.error.name;
      self.debug(msg);
    };

    getreq.onsuccess = function() {
      var file = getreq.result;
      // When we got the file by storage type of "sdcard"
      // use the file.type to replace the empty fileType which is given by API
      var fileName = file.name;
      var extension = fileName.split('.').pop();
      var originalType = file.type || contentType;
      var mappedType = (MimeMapper.isSupportedType(originalType)) ?
        originalType : MimeMapper.guessTypeFromExtension(extension);

      var a = new MozActivity({
        name: mappedType == 'text/vcard' ? 'import' : 'open',
        data: {
          type: mappedType,
          blob: file,
          // XXX: https://bugzilla.mozilla.org/show_bug.cgi?id=812098
          // Pass the file name for Music APP since it can not open blob
          filename: fileName
        }
      });

      a.onerror = function(e) {
        var msg = 'open activity error:' + a.error.name;
        self.debug(msg);
        switch (a.error.name) {
        case 'NO_PROVIDER':
          Service.request('NotificationView:close');
          // Cannot identify MIMETYPE
          // So, show cannot open file dialog with unknow media type
          self.showUnknownMediaPrompt(fileName);
          return;
        case 'ActivityCanceled':
          return;
        case 'USER_ABORT':
          return;
        default:
          return;
        }
      };
      a.onsuccess = function(e) {
        var msg = 'open activity onsuccess';
        self.debug(msg);
      };
    };
  },

  showUnknownMediaPrompt: function bt_showUnknownMediaPrompt(fileName) {
    var _ = navigator.mozL10n.get;
    var body = _('unknownMediaTypeToOpenFile',{fileName: fileName});
    Service.request('DialogService:show', {
      title: _('cannotOpenFile'),
      content: body,
      translated: true,
      type: 'alert'
    });
  }

};

exports.BluetoothTransfer = BluetoothTransfer;
})(window);
