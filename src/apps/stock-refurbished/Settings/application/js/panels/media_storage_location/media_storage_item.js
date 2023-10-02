define(['require','modules/app_storage'],function (require) {
  

  var AppStorage = require('modules/app_storage');

  const MIN_MEDIA_FREE_SPACE_SIZE = 10 * 1024 * 1024;
  const TOTAL_SIZE = 4 * 1024 * 1024 * 1024;

  function MediaStorageItem() {
    this._enabled = false;
    this._elements = null;
    this._defaultMediaVolume = null;
    this._anotherMediaVolume = null;
    this._volumes = null;
    this._defaultVolumeState = 'available';
    this._updateSystemSpace = this._updateSystemSpace.bind(this);
    this.storage = {
      mediaSize: 0,
      totalSize: TOTAL_SIZE
    };
  }

  MediaStorageItem.prototype = {
    get enabled() {
      return this._enabled;
    },

    set enabled(value) {
      if (this._enabled === value) {
        return;
      } else {
        this._enabled = value;
      }
      if (value) {
        window.addEventListener('localized', this);

        DeviceFeature.ready(() => {
          this._mediaVolumeChangeHandler();

          var size = DeviceFeature.getValue('totalSize');
          this.storage.totalSize = parseInt(size);
          var el = document.getElementById('header-internal-size');
          DeviceStorageHelper.showFormatedSize(el,
            'storage-name-internal-size', this.storage.totalSize);
          this._updateSystemSpace();
          AppStorage.storage.observe('totalSize', this._updateSystemSpace);
        });
      } else {
        AppStorage.storage.unobserve('totalSize', this._updateSystemSpace);
        window.removeEventListener('localized', this);
      }
    },

    handleEvent: function storage_handleEvent(evt) {
      switch (evt.type) {
        case 'localized':
          this._updateMediaStorageInfo(true);
          this._updateMediaStorageInfo(false);
          break;
        case 'change':
          if ('sdcard' === evt.target.storageName) {
            this._updateMediaStorageInfo(true);
          } else {
            this._updateMediaStorageInfo(false);
          }
          break;
      }
    },

    _mediaVolumeChangeHandler:
      function storage_mediaVolumeChangeHandler(defaultName) {
        this._defaultMediaVolume = this._getDefaultVolume(defaultName);
        this._defaultMediaVolume.addEventListener('change', this);
        this._updateMediaStorageInfo(true);
        if (this._volumes.length > 1) {
          navigator.getDeviceStorages('sdcard')[1].available().then((value) =>{
            if (value === 'available') {
              this._elements.mediaStorageSDHeader.classList.remove('hidden');
              this._elements.mediaStorageSDUl.classList.remove('hidden');
              this._anotherMediaVolume = this._getAnotherVolume();
              this._anotherMediaVolume.addEventListener('change', this);
              this._updateMediaStorageInfo(false);
            }
          });
        }
      },

    _updateMediaStorageInfo: function storage_updateMediaStorageInfo(defaultVolume) {
      if (defaultVolume) {
        if (!this._defaultMediaVolume) {
          return;
        }
        var self = this;
        this._defaultMediaVolume.available().onsuccess = function(evt) {
          var state = evt.target.result;
          var firstVolume = navigator.getDeviceStorages('sdcard')[0];
          if (state === 'unavailable' &&
            self._defaultMediaVolume.storageName !== firstVolume.storageName) {
            firstVolume.available().onsuccess = function(e) {
              self._updateVolumeState(firstVolume, e.target.result);
            };
          } else {
            self._updateVolumeState(self._defaultMediaVolume, state);
          }
        };
      } else {
        if (!this._anotherMediaVolume) {
          return;
        }
        var self = this;
        this._anotherMediaVolume.available().onsuccess = function(evt) {
          var state = evt.target.result;
          self._updateVolumeState(self._anotherMediaVolume, state, true);
        };
      }

    },

    _updateVolumeState: function storage_updateVolumeState(volume, state, defaultVolum) {
      if (!defaultVolum) {
        this._defaultVolumeState = state;
      }
      var el = this._elements.mediaStorageDesc;
      if (volume.storageName !== 'sdcard') {
        el = this._elements.mediaStorageSDDesc;
      }
      switch (state) {
        case 'available':
          this._updateMediaFreeSpace(volume);
          this._lockMediaStorageMenu(volume, false);
          break;
        case 'shared':
          el.removeAttribute('data-l10n-id');
          el.textContent = '';
          this._lockMediaStorageMenu(volume, false);
          break;
        case 'unavailable':
          el.setAttribute('data-l10n-id', 'no-storage');
          this._lockMediaStorageMenu(volume, true);
          break;
      }
    },

    _updateMediaFreeSpace: function storage_updateMediaFreeSpace(volume) {
      var self = this;
      var results = {};
      volume.usedSpace().onsuccess = function(e) {
        results['used'] = e.target.result;
        volume.totalSpace().onsuccess = function(e) {
          var element = self._elements.mediaStorageDesc;
          if (volume.storageName !== 'sdcard') {
            element = self._elements.mediaStorageSDDesc;
          }
          results['total'] = e.target.result;
          self.storage.mediaSize = results['total'];
          if (volume.storageName === 'sdcard') {
            self._updateSystemSpace();
          } else {
            var el = document.getElementById('header-external-size');
            DeviceStorageHelper.showFormatedSize(el,
              'storage-name-external-0-size',
              results['total']);
          }
          DeviceStorageHelper.showFormatedSizeOfUsedAndTotal(element,
            'usedOfTotal', results);
          if (e.target.result < MIN_MEDIA_FREE_SPACE_SIZE) {
            element.parentNode.setAttribute('data-state', 'no-space');
          } else {
            element.parentNode.setAttribute('data-state', '');
          }
        };
      };
    },

    _updateSystemSpace: function storage_updateSystemSpace() {
      if (!AppStorage.storage.totalSize) {
        return;
      }

      var element = this._elements.systemStorageDesc;
      var systemSize = this.storage.totalSize - this.storage.mediaSize -
        AppStorage.storage.totalSize;
      DeviceStorageHelper.showFormatedSize(element,
        'storageSize', parseInt(systemSize));
      if (systemSize < MIN_MEDIA_FREE_SPACE_SIZE) {
        element.parentNode.setAttribute('data-state', 'no-space');
      } else {
        element.parentNode.setAttribute('data-state', '');
      }
    },

    _lockMediaStorageMenu: function storage_setMediaMenuState(volume, lock) {
      var el = this._elements.mediaStorageSection;
      if (volume.storageName !== 'sdcard') {
        el = this._elements.mediaStorageSDSection;
      }

      if (lock) {
        el.setAttribute('aria-disabled', true);
        el.classList.add('none-select');
        el.querySelector("a").removeAttribute("href");
      } else {
        el.removeAttribute('aria-disabled');
        el.classList.remove('none-select');
        el.querySelector('a').setAttribute('href',"#mediaStorageDesc");
      }
    },

    _getAnotherVolume: function storage_getAnotherVolume() {
      for (var i = 0; i < this._volumes.length; ++i) {
        if (this._volumes[i].storageName !==
          this._defaultMediaVolume.storageName) {
          return this._volumes[i];
        }
      }
      return this._volumes[1];
    },

    _getDefaultVolume: function storage_getDefaultVolume(name) {
      var volumes = navigator.getDeviceStorages('sdcard');
      this._volumes = volumes;
      if (!name || name === '') {
        return volumes[0];
      }
      for (var i = 0; i < volumes.length; ++i) {
        if (volumes[i].storageName === name) {
          return volumes[i];
        }
      }
      return volumes[0];
    },

    onInit: function(panel, elements) {
      this.panel = panel;
      this._elements = elements;
    }
  };

  return function ctor_languages() {
    return new MediaStorageItem();
  };
});
