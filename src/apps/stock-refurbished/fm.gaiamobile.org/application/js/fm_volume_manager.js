/* exported FMVolumeManager */
'use strict';

(function(exports) {

  // FMVolumeManager Constructor
  // FMVolumeManager will be loaded only while adapt volume
  var FMVolumeManager = function() {
    this.volumeTimer = null;
    this.volumeManager = navigator.volumeManager;
  };

  FMVolumeManager.prototype.requestVolume = function(option) {
    if (!FMSoftkeyHelper.volumeIsAdjusting && option === 'show') {
      // Make sure FMVolumeManager works fine
      FMSoftkeyHelper.volumeIsAdjusting = true;
    }

    // Make sure volume is adjusting before adjust volume
    if (!FMSoftkeyHelper.volumeIsAdjusting) {
      return;
    }

    clearTimeout(this.volumeTimer);
    this.volumeTimer = null;

    if (this.volumeManager) {
      switch (option) {
        case 'up':
          this.volumeManager.requestUp();
          break;
        case 'down':
          this.volumeManager.requestDown();
          break;
        case 'show':
          this.volumeManager.requestShow();
          break;
        default:
          return;
      }
    }

    // Volume adjusting screen only show in 2000 ms
    this.volumeTimer = setTimeout(() => {
      FMSoftkeyHelper.volumeIsAdjusting = false;
    }, 2000);
  };

  exports.FMVolumeManager = new FMVolumeManager();
})(window);
