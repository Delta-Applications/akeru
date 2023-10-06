
'use strict';

/**
 * This is the constructor that will represent a download notification
 * in the system
 *
 * @param {Object} download object provided by the API.
 */
function DownloadNotification(download) {
  /* Sample
   * {
       totalBytes: 5242880,
       currentBytes: 755617,
       url: "http://web4host.net/5MB.zip",
       path: "/mnt/media_rw/9016-4EF8/downloads/5…",
       storageName: "sdcard",
       storagePath: "downloads/5MB.zip",
       state: "downloading",
       contentType: "application/zip",
       startTime: Date 1970-01-01T01:00:01.032Z,
       id: "download-0"
      }
  */
  this.download = download;
  this.fileName = DownloadFormatter.getFileName(download);
  this.state = 'started';
  this.id = DownloadFormatter.getUUID(download);

  // We have to listen for state changes
  this.listener = this._update.bind(this);
  this.download.addEventListener('statechange', this.listener);

  if (download.state === 'started') {
    Service.request('NotificationStore:add', this._getInfo());
  } else {
    // For adopted downloads, it is possible for the download to already be
    // completed.
    this._update();
  }
}

DownloadNotification.prototype = {

  /**
   * This method knows when the toaster should be displayed. Basically
   * the toaster shouldn't be displayed if the download state does not change
   * or the download was stopped by the user or because of connectivity lost
   *
   * @return {boolean} True whether the toaster should be displayed.
   */
  _wontNotify: function dn_wontNotify() {
    var download = this.download;
    return this.state === download.state ||
           download.state === 'downloading' ||
          (download.state === 'stopped' && download.error === null);
  },

  /**
   * It updates the notification when the download state changes.
   */
  _update: function dn_update(evt) {
    if (this.download.state === 'finalized') {
      // If the user delete the file, we will see this state and what we have to
      // do, is to remove the notification
      this._close();
      return;
    }
    var noNotify = this._wontNotify();
    this.state = this.download.state;
    if (evt && this.download.state === 'stopped') {
      this._onStopped();
    }
    var info = this._getInfo();
    if (noNotify) {
      info.noNotify = true;
    }
    if (this.state === 'downloading') {
      info.mozbehavior = {
        noscreen: true
      };
    }
    Service.request('NotificationStore:add', info);
    if (this.state === 'succeeded') {
      this._onSucceeded();
    }
  },

  _onStopped: function dn_onStopped() {
    if (this.download.error !== null) {
      // Error attr will be not null when a download is stopped because
      // something failed
      this.state = 'failed';
      this._onError();
    } else if (!window.navigator.onLine) {
      // Remain downloading state when the connectivity was lost
      this.state = 'downloading';
    }
  },

  _onError: function dn_onError() {
    var result = parseInt(this.download.error.message);

    switch (result) {
      case DownloadUI.ERRORS.NO_MEMORY:
        DownloadUI.show(DownloadUI.TYPE['NO_MEMORY'],
                        this.download,
                        true);
        break;
      case DownloadUI.ERRORS.NO_SDCARD:
        DownloadUI.show(DownloadUI.TYPE['NO_SDCARD'],
                        this.download,
                        true);
        break;
      case DownloadUI.ERRORS.UNMOUNTED_SDCARD:
        DownloadUI.show(DownloadUI.TYPE['UNMOUNTED_SDCARD'],
                        this.download,
                        true);
        break;

      default:
        DownloadHelper.getFreeSpace((function gotFreeMemory(bytes) {
          if (bytes === 0) {
            DownloadUI.show(DownloadUI.TYPE['NO_MEMORY'], this.download, true);
          }
        }).bind(this));
    }
  },

  _onSucceeded: function dn_onSucceeded() {
    this._storeDownload(this.download);
  },

  /**
   * This method stores complete downloads to share them with the download list
   * in settings app
   *
   * @param {Object} The download object provided by the API.
   */
  _storeDownload: function dn_storeDownload(download) {
    var req = DownloadStore.add(download);

    req.onsuccess = (function _storeDownloadOnSuccess(request) {
      // We don't care about any more state changes to the download.
      this.download.removeEventListener('statechange', this.listener);
      // Update the download object to the datastore representation.
      // XXX: bad practice: instance type changed from DOMDownload to Object
      this.download = req.result;
    }).bind(this);

    req.onerror = function _storeDownloadOnError(e) {
      console.error('Exception storing the download', download.id, '(',
                     download.url, ').', e.target.error);
    };
  },

  _ICONS_PATH: 'style/notifications/images/',

  _ICONS_EXTENSION: '.png',

  /**
   * It returns the icon depending on current state
   *
   * @return {String} Icon path.
   */
  _getIcon: function dn_getIcon() {
    var icon = (this.state === 'downloading' ? 'downloading' : 'download');
    return this._ICONS_PATH + icon + this._ICONS_EXTENSION;
  },

  /**
   * This method returns an object to update the notification composed by the
   * text, icon and type
   *
   * @return {object} Object descriptor.
   */
  _getInfo: function dn_getInfo() {
    var state = this.state;
    var _ = navigator.mozL10n.get;

    var info = {
      id: this.id,
      title: this.fileName,
      icon: this._getIcon(),
      type: 'download-notification-' + state,
      isDownload: true,
      dismissable: state === 'succeeded' || state === 'stopped' || state === 'failed',
      callback: () => {
        this.onClick();
      }
    };

    if (state === 'downloading') {
      info.text = _('download_downloading', {
        percentage: DownloadFormatter.getPercentage(this.download)
      });
      info.progress = DownloadFormatter.getPercentage(this.download);
      info.sizeText = _('partialResult', {
        partial: DownloadFormatter.getDownloadedSize(this.download),
        total: DownloadFormatter.getTotalSize(this.download)
      });
    } else {
      info.text = _('download_' + state);
      info.progress = null;
    }

    return info;
  },

  /**
   * Closes the notification
   */
  _close: function dn_close() {
    Service.request('NotificationStore:remove', this.id);
    this.onClose();
  },

  /**
   * It performs the action when the notification is clicked by the user
   * depending on state:
   *
   * - 'downloading' -> launch the download list
   * - 'stopped' -> show confirmation to resume the download
   * - 'finalized' -> show confirmation to retry the download
   * - 'succeeded' -> open the downloaded file
   *
   * @param {function} Function that will be invoked when the notification
   *                   is removed from utility tray.
   */
  onClick: function dn_onClick() {
    switch (this.download.state) {
      case 'downloading':
      case 'stopped':
        // Launching settings > download list
        var activity = new MozActivity({
          name: 'configure',
          data: {
            target: 'device',
            section: 'downloads',
            downloadFileName: this.fileName
          }
        });
        break;
      case 'succeeded':
        // Attempts to open the file
        var download = this.download;
        var req = DownloadHelper.open(download);

        req.onerror = () => {
          this.handlerError(req.error);
        };
        break;
    }

    // always clear the notification according the spec
    if (this.download.state !== 'downloading') {
      this._close();
    }
  },

  /**
   * DownloadUI will use an existing DOM element to render the dialog,
   * which may cause problem in system app. So we have our own UI.
   */
  handlerError: function(error) {
    var req;

    // Canceled activites are normal and shouldn't be interpreted as errors.
    // Unfortunately, this isn't reported in a standard way by our
    // applications (or third party apps for that matter). This is why we
    // have this lazy filter here that may need to be updated in the future
    // but hopefully will just get removed.
    if (error.message &&
        (error.message.endsWith('canceled') ||
         error.message.endsWith('cancelled'))) {
      return;
    }
    var onOk;
    switch (error._download_message || error.message) {
      case 'NO_SDCARD':
      case 'UNMOUNTED_SDCARD':
      case 'FILE_NOT_FOUND':
      case 'NO_PROVIDER':
        break;

      case 'MIME_TYPE_NOT_SUPPORTED':
      default:
        onOk = () => {
          // We need to wait the current dialog to close because DialogService
          // does not support multiple dialogs.
          window.setTimeout(() => {
            this.showDownloadUI(DownloadUI.TYPE.DELETE, () => {
              DownloadHelper.remove(this.download);
            });
          });
        };
        break;
    }

    this.showDownloadUI(DownloadUI.TYPE[error.message], onOk)
  },

  showDownloadUI: function(type, onOk) {
    var message = '';
    var _ = navigator.mozL10n.get;
    var args = Object.create(null);
    args.name = this.fileName;
    message = _(type.name + '_download_message', args);

    Service.request('DialogService:show', {
      header: _(type.name + '_download_title'),
      content: message,
      type: onOk ? 'confirm' : 'alert',
      translated: true,
      onOK: onOk
    });
  },

  /**
   * This method releases memory destroying the notification object
   */
  onClose: function dn_onClose() {
    if (this.download instanceof DOMDownload) {
      this.download.removeEventListener('statechange', this.listener);
    }
    // We need to keep this.download because we may need to show dialog according to download instance.
  }
};
