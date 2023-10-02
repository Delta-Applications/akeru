/* global SettingsSoftkey */
define(['require','modules/settings_panel','modules/settings_service','modules/app_storage','panels/media_storage_location/media_storage_item'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var AppStorage = require('modules/app_storage');
  var MediaStorageItem =
    require('panels/media_storage_location/media_storage_item');
  const DEFAULT_MEDIA_KEY = 'device.storage.writable.name';
  const MIN_APP_FREE_SPACE_SIZE = 50 * 1024 * 1024;

  return function ctor_storage_panel() {
    var items = {};
    var elements = {};
    var mediaStorageItem = MediaStorageItem();
    var listElements = document.querySelectorAll('#mediaStorage li');


    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(softkeyParams);
    }

    function _updateSoftkey() {
      var classList = document.activeElement.classList;
      if (classList && classList.contains('none-select')) {
        SettingsSoftkey.hide();
      } else {
        SettingsSoftkey.show();
      }
    }

    function handlerEvent(evt) {
      if (evt.key === 'Enter') {
        if (document.activeElement === items.meadiaStorageItem) {
          SettingsService.navigate('mediaStorageDesc', {type: 'sdcard'} );
        } else if (document.activeElement === items.meadiaStorageSDItem) {
          SettingsService.navigate('mediaStorageDesc', {type: 'sdcard1'} );
        } else if (document.activeElement === items.cleanUpButton) {
          SettingsService.navigate('applicationStorage');
        }
      } else if (evt.key === 'Backspace') {
        if (window.ActivityHandler) {
          window.close();
        }
      }
    }

    function _handleEvent(evt) {
      switch (evt.type) {
        case 'localized':
          _updateAppFreeSpace();
          break;
      }
    }

    function _keyDownHandle(evt) {
      if (evt.key === 'Enter' &&
        !document.getElementById('media-location-select').disabled) {
        _showDialog();
      }
    }

    function _updateLowSpaceDisplay() {
      if (AppStorage.storage.freeSize < MIN_APP_FREE_SPACE_SIZE) {
        items.appDataDesc.parentNode.setAttribute('data-state', 'no-space');
      } else {
        items.appDataDesc.parentNode.setAttribute('data-state', '');
      }
    }

    function _updateAppFreeSpace() {
      var results = {};
      results['used'] = AppStorage.storage.usedSize;
      results['total'] = AppStorage.storage.totalSize;
      DeviceStorageHelper.showFormatedSizeOfUsedAndTotal(items.appDataDesc,
        'usedOfTotal', results);
      _updateLowSpaceDisplay();
    }

    function _updateMediaLocationDesc(value) {
      if (value === 'sdcard') {
        document.getElementById('default-media-location').
        setAttribute('data-l10n-id', 'short-storage-name-internal');
      } else {
        document.getElementById('default-media-location').
        setAttribute('data-l10n-id', 'short-storage-name-external-0');
      }
    }

    function _showDialog() {
      var dialogConfig = {
        title: {
          id: 'confirmation',
          args: {}
        },
        body: {
          id: 'change-default-media-location-confirmation',
          args: {}
        },
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Change',
          l10nId: 'change',
          priority: 3,
          callback: function() {
            var select = document.getElementById('media-location-select');
            select.hidden = false;
            select.focus();
            select.hidden = true;
          }
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    return SettingsPanel({
      onInit: function(panel) {
        items = {
          defaultMeadiaLocation :
            panel.querySelector('.default-media-location'),
          meadiaStorageItem : panel.querySelector('.media-storage-section'),
          meadiaStorageSDItem :
            panel.querySelector('.media-storageSD-section'),
          appDataDesc : panel.querySelector('.application-storage-desc'),
          cleanUpButton : panel.querySelector('.clean-up')
        };

        elements =  {
            mediaStorageDesc: panel.querySelector('.media-storage-desc'),
            mediaStorageSDDesc: panel.querySelector('.media-storageSD-desc'),
            systemStorageDesc: panel.querySelector('.system-storage-desc'),
            mediaStorageSection: panel.querySelector('.media-storage-section'),
            mediaStorageSDHeader:
              panel.querySelector('#media-storageSD-header'),
            mediaStorageSDUl: panel.querySelector('#media-storageSD-ul'),
            mediaStorageSDSection:
              panel.querySelector('.media-storageSD-section')
        };
        mediaStorageItem.onInit(panel, elements);

        navigator.mozSettings.createLock().get(DEFAULT_MEDIA_KEY).then(
          (result) => {_updateMediaLocationDesc(result[DEFAULT_MEDIA_KEY]);}
        );

        window.addEventListener('panelready', e => {
          switch (e.detail.current) {
            case '#mediaStorageDesc':
            case '#applicationStorage':
              if (NavigationMap._optionsShow === false) {
                var header = document.querySelectorAll('.current [data-href]');
                header[0].setAttribute('data-href',
                  '#mediaStorage');
              };
              break;
          }
        });
      },

      onBeforeShow: function(panel) {
        _initSoftKey();
        _updateSoftkey();
        navigator.mozSettings.addObserver(DEFAULT_MEDIA_KEY, (event) => {
          _updateMediaLocationDesc(event.settingValue);
          showToast('media-storage-changed');
        });

        //storage_app_item
        AppStorage.storage.observe('usedSize', _updateAppFreeSpace.bind(this));
        AppStorage.storage.observe('usedPercentage',
          _updateLowSpaceDisplay.bind(this));
        _updateAppFreeSpace();
        window.addEventListener('localized', _handleEvent);

        if (navigator.getDeviceStorages('sdcard').length > 1) {
          navigator.getDeviceStorages('sdcard')[1].available().then((value) =>{
            if (value === 'available') {
              elements.mediaStorageSDHeader.classList.remove('hidden');
              elements.mediaStorageSDUl.classList.remove('hidden');
              items.defaultMeadiaLocation.addEventListener('keydown', _keyDownHandle);
              NavigationMap.refresh();
            } else {
              items.defaultMeadiaLocation.classList.add('none-select');
              items.defaultMeadiaLocation.setAttribute('aria-disabled', true);
              _updateSoftkey();
            }
          });
        } else {
          items.defaultMeadiaLocation.classList.add('none-select');
          items.defaultMeadiaLocation.setAttribute('aria-disabled', true);
        }

        mediaStorageItem.enabled = true;
        window.addEventListener('keydown', handlerEvent);
        ListFocusHelper.addEventListener(listElements);
      },

      onShow: function() {},

      onBeforeHide: function () {
        ListFocusHelper.removeEventListener(listElements);
        window.removeEventListener('keydown', handlerEvent);

        //storage_app_item
        AppStorage.storage.unobserve('usedSize',
          this._boundUpdateAppFreeSpace);
        AppStorage.storage.unobserve('usedPercentage',
          this._boundUpdateLowSpaceDisplay);
        window.removeEventListener('localized', _handleEvent);
      },

      onHide: function () {
      }
    });
  };
});
