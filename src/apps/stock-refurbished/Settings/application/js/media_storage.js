/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */



/**
 * The whole purpose of this code is to detect when we're in the state of having
 * the UMS Enabled checkbox unchecked, but the SD-card is still being shared
 * with the PC.
 *
 * In this case, the user has to unplug the USB cable in order to actually turn
 * off UMS, and we put some text to that effect on the settings screen.
 */
 define(['require','exports','module','modules/apps_cache','modules/settings_cache','modules/settings_service'],function(require, exports, module){
  var AppsCache = require('modules/apps_cache');
  var SettingsCache = require('modules/settings_cache');
  var SettingsService = require('modules/settings_service');
  const MEDIA_TYPE = ['music', 'pictures', 'videos', 'sdcard'];
  const ITEM_TYPE = ['music', 'pictures', 'videos', 'other', 'free'];
  const EXTERNAL_UNRECOGNISED_KEY = 'volume.external.unrecognised';
  const DEFAULT_MEDIA_KEY = 'device.storage.writable.name';
  const INTERNAL_TYPE = 'sdcard';
  var once = true ;
  var storageType = null;
  var mediaApps = {};
  var Volume = function(name, external, externalIndex, storages) {
    this.name = name;
    this.external = external;
    this.isUnrecognised = false;
    this.externalIndex = externalIndex;
    this.storages = storages;
    this.currentStorageStatus = null;
    this.rootElement = null;  //<ul></ul>
    this.stackedbar = null;
  };
  // This function will create a view for each volume under #volume-list,
  // the DOM structure looks like:
  //
  //<header>
  //  <h2 data-l10n-id="storage-name-internal">Internal Storage</h2>
  //</header>
  //<ul>
  //  <li>
  //    <div id="sdcard-space-stackedbar" class="space-stackedbar">
  //      <!-- stacked bar for displaying the amounts of media type usages -->
  //    </div>
  //  </li>
  //  <li class="color-music">
  //    <span class="stackedbar-color-label"></span>
  //    <a data-l10n-id="music-space">Music
  //      <span class="size"></span>
  //    </a>
  //  </li>
  //  <li class="color-pictures">
  //    <span class="stackedbar-color-label"></span>
  //    <a data-l10n-id="pictures-space">Pictures
  //      <span class="size"></span>
  //    </a>
  //  </li>
  //  <li class="color-videos">
  //    <span class="stackedbar-color-label"></span>
  //    <a data-l10n-id="videos-space">Videos
  //      <span class="size"></span>
  //    </a>
  //  </li>
  //  <li class="color-free">
  //    <span class="stackedbar-color-label"></span>
  //    <a data-l10n-id="free-space">Space left
  //      <span class="size"></span>
  //    </a>
  //  </li>
  //  <li class="total-space">
  //    <span></span>
  //    <a data-l10n-id="total-space">Total space
  //      <span class="size"></span>
  //    </a>
  //  </li>
  //  </li>
  //    <label>
  //      <button data-l10n-id="format-sdcard" disabled="true">
  //      Format SD card
  //      </button>
  //    </label>
  //  </li>
  //  </li> <!-- unmount button for displaying external storage only -->
  //    <label>
  //      <button data-l10n-id="eject-sdcard" disabled="true">
  //      Eject SD card
  //      </button>
  //    </label>
  //  </li>
  //</ul>

  Volume.prototype.getVolumeId = function volume_getVolumeId() {
    return (this.external) ? 'external-' + this.externalIndex : 'internal';
  };

  Volume.prototype.getL10nId = function volume_getL10nId(useShort) {
    var prefix = useShort ? 'short-storage-name-' : 'storage-name-';
    return prefix + this.getVolumeId();
  };

  Volume.prototype.createView = function volume_createView(listRoot) {
    // declair re-useable variables
    var l10nId, li, label, text, size, anchor, buttonType;

    var div = document.createElement('div');
    div.id = this.name;
    listRoot.appendChild(div);
    // create ul
    this.rootElement = document.createElement('ul');
    div.appendChild(this.rootElement);

    var stackedbarDiv = document.createElement('div');
    stackedbarDiv.id = this.name + '-space-stackedbar';
    stackedbarDiv.classList.add('space-stackedbar');
    li = document.createElement('li');
    li.id = 'stacked-bar';
    li.classList.add('non-focus');

    li.appendChild(stackedbarDiv);
    this.rootElement.appendChild(li);
    this.stackedbar = StackedBar(stackedbarDiv);

    var self = this;
    ITEM_TYPE.forEach(function(type) {
      label = document.createElement('span');
      label.classList.add('stackedbar-color-label');
      anchor = document.createElement('a');
      size = document.createElement('span');
      size.classList.add('size');
      size.hidden = true;
      text = document.createElement('span');
      l10nId = type + '-space';
      text.setAttribute('data-l10n-id', l10nId);
      anchor.appendChild(text);
      anchor.appendChild(size);
      li = document.createElement('li');
      li.classList.add('color-' + type);
      li.appendChild(label);
      li.appendChild(anchor);
      self.rootElement.appendChild(li);
    });

    anchor = document.createElement('a');
    size = document.createElement('span');
    size.classList.add('size');
    size.hidden = true;
    text = document.createElement('span');
    l10nId = 'total-space';
    text.setAttribute('data-l10n-id', l10nId);
    anchor.appendChild(text);
    anchor.appendChild(size);
    li = document.createElement('li');
    li.classList.add('total-space');
    li.appendChild(anchor);
    this.rootElement.appendChild(li);

    if (this.name !== INTERNAL_TYPE && this.storages.sdcard.canBeFormatted) {
      buttonType = 'format-sdcard-' + this.getVolumeId();
      var a = document.createElement('a');
      if (this.external) {
        a.id = 'format-sdcard';
      }
      var span = document.createElement('span') ;
      span.setAttribute('data-l10n-id', buttonType);
      span.classList.add('menu-item');
      a.appendChild(span) ;
      var small2 =  document.createElement('small');
      small2.classList.add('format-sdcard-desc') ;
      small2.classList.add('menu-item-desc');
      a.appendChild(small2) ;
      a.onclick = this.formatSDCard.bind(this);
      li = document.createElement('li');
      li.classList.add('format-btn');
      li.appendChild(a) ;
      this.rootElement.appendChild(li);
    }
  };

  Volume.prototype.updateStorageInfo = function volume_updateStorageInfo() {
    // Update the storage details
    var self = this;
    this.getStats(function(sizes) {
      self.stackedbar.reset();
      ITEM_TYPE.forEach(function(type) {
        var element =
          self.rootElement.querySelector('.color-' + type + ' .size');
        DeviceStorageHelper.showFormatedSize(
          element, 'storageSize', sizes[type]);
        element.hidden = false;
        self.stackedbar.add({ 'type': type, 'value': sizes[type] });
      });
      self.stackedbar.refreshUI();

      // update total space size
      var element =
        self.rootElement.querySelector('[data-l10n-id="total-space"] + .size');
      DeviceStorageHelper.showFormatedSize(element, 'storageSize',
                                           sizes['sdcard'] + sizes['free']);
      element.hidden = false;
    });
  };

  Volume.prototype.enableStorageInfo =
    function volume_enableStorageInfo(enabled) {
    // the storage details
    ITEM_TYPE.forEach(function(type) {
      var rule = 'li.color-' + type ;
      var element = this.rootElement.querySelector(rule);
      element.setAttribute('aria-disabled', !enabled);
      if (!enabled) {
        element.classList.add('none-select');
      } else {
        element.classList.remove('none-select');
      }
    }.bind(this));

    // total space size
    var rule = 'li.total-space';
    var element = this.rootElement.querySelector(rule);
    element.setAttribute('aria-disabled', !enabled);
    if (!enabled) {
      element.classList.add('none-select');
    } else {
      element.classList.remove('none-select');
    }
  };

  // Update external storage UI state only
  Volume.prototype.updateStorageUIState =
    function volume_updateStorageUIState(enabled, isUnrecognisedEventUpdate) {
    // If storage is formatting, we keep the information to figure out the
    // status. Just do early return.
    if (this.isFormatting && !enabled) {
      return;
    }

    // If storage is unrecognised, we keep the information to figure out the
    // status. Just do early return.
    if (this.isUnrecognised && !enabled) {
      return;
    }

    // If receive unrecognised event update with disabled request, and the
    // storage status is 'Mounted', let's ignore the update. Because settings
    // key 'volume.external.unrecognised' will be updated while volume storage
    // is detecting an inserted SD card every time. Sometimes, the key observer
    // event comes after 'storage-state-change' event. It will disable the
    // external storage information here.
    if (isUnrecognisedEventUpdate && !enabled &&
        (this.currentStorageStatus === 'Mounted')) {
      return;
    }

    // set enabled/disabled information for external storage only
    if (this.getVolumeId() === 'internal') {
      return;
    }

    var formatItem = document.querySelector("#format-sdcard");
    if (formatItem) {
      formatItem.parentNode.hidden = !enabled;
    }

    // external storage information
    this.rootElement.hidden = !enabled;
    // If storage is unrecognised, we just display header and format button.
    // Then, do early return from here.
    if (isUnrecognisedEventUpdate) {
      // set stacked bar to be hidden
      this.rootElement.querySelector('.space-stackedbar').parentNode.hidden =
        enabled;

      // disable storage details, total space size
      // while the storage is unrecognised
      if (enabled) {
        // storage details
        ITEM_TYPE.forEach(function(type) {
          var rule = 'li.color-' + type ;
          this.rootElement.querySelector(rule).hidden = enabled;
        }.bind(this));

        // total space size
        var rule = 'li.total-space';
        this.rootElement.querySelector(rule).hidden = enabled;
      }
      return;
    }

    // storage details
    ITEM_TYPE.forEach(function(type) {
      var rule = 'li.color-' + type ;
      this.rootElement.querySelector(rule).hidden = !enabled;
    }.bind(this));

    // total space size
    var rule = 'li.total-space';
    this.rootElement.querySelector(rule).hidden = !enabled;
  };

  Volume.prototype.getStats = function volume_getStats(callback) {
    var results = {};
    var current = MEDIA_TYPE.length;
    var storages = this.storages;
    MEDIA_TYPE.forEach(function(type) {
      var storage = storages[type];
      storage.usedSpace().onsuccess = function(e) {
        results[type] = e.target.result;
        current--;
        if (current == 0) {
          storage.freeSpace().onsuccess = function(e) {
            results['free'] = e.target.result;
            if (callback) {
              results['other'] = results['sdcard'] - results['music']
                - results['pictures'] - results['videos'];
              callback(results);
            }
          };
        }
      };
    });
  };

  Volume.prototype.updateInfo = function volume_updateInfo(callback) {
    var self = this;
    var availreq = this.storages.sdcard.available();
    availreq.onsuccess = function availSuccess(evt) {
      var state = evt.target.result;
      switch (state) {
        case 'shared':
          self.updateStorageUIState(true);
          self.setInfoUnavailable();
          self.enableStorageInfo(false);
          break;
        case 'unavailable':
          self.setInfoUnavailable();
          self.enableStorageInfo(false);
          self.updateStorageUIState(false);
          self.enableFormatSDCardBtn(false);
          break;
        case 'available':
          self.updateStorageUIState(true);
          self.updateStorageInfo();
          self.enableStorageInfo(true);
          self.enableFormatSDCardBtn(true);
          break;
      }
      if(Settings.currentPanel=="#mediaStorageDesc"){
        var event = new CustomEvent('panelready',{
          detail:{
            current:Settings.currentPanel
          }
        });
        window.dispatchEvent(event);
      }
      if (callback)
        callback(state);
    };
  };

  Volume.prototype.updateUIState =
  function volume_updateUIState(storageStatus) {
    switch (storageStatus) {
      case 'Init':
      case 'NoMedia':
      case 'Pending':
      case 'Unmounting':
        this.updateStorageUIState(false);
        this.enableFormatSDCardBtn(false);
        break;
      case 'Shared':
      case 'Shared-Mounted':
        this.updateStorageUIState(true);
        this.enableFormatSDCardBtn(false);
        break;
      case 'Formatting':
        this.enableFormatSDCardBtn(false, true);
        // Set isFormatting flag to be false after button updated already,
        // because we can not reset it in idle status.
        showToast(this.external ? 'sdcardformatted' : 'internalformatted');
        this.isFormatting = false;
        break;
      case 'Checking':
        this.isFormatting = false;
        break;
      case 'Idle': // means Unmounted
        // pop up a toast to guide a user to remove SD card
        if (this.isUnmounting) {
          this.isUnmounting = false;
          // create toast
          showToast('sdcardUnmounted');
          SettingsService.navigate('root');
        }
        this.updateStorageUIState(false);
        break;
      case 'Mounted':
        this.updateStorageUIState(true);
        this.enableFormatSDCardBtn(true);
        break;
    }
  };

  Volume.prototype.setInfoUnavailable = function volume_setInfoUnavailable() {
    var self = this;
    ITEM_TYPE.forEach(function(type) {
      var rule = '.color-' + type + ' .size';
      var element = self.rootElement.querySelector(rule);
      element.setAttribute('data-l10n-id', 'size-not-available');
    });
    // set total space info.
    var element =
      this.rootElement.querySelector('.total-space .size');
    element.setAttribute('data-l10n-id', 'size-not-available');
    // stacked bar reset
    this.stackedbar.reset();
  };

  Volume.prototype.mountSDCard = function volume_mountSDCard(evt) {
    this.storages.sdcard.mount();
  };

  Volume.prototype.formatSDCard = function volume_formatSDCard(evt) {
    // Pop up a confirm window before format SD card.
    var disabled =
      JSON.parse(evt.target.parentNode.getAttribute('aria-disabled'));
    if(disabled){
      return ;
    }
       var self = this;
       if (!this.external) {
         var dialogHeader = 'format-sdcard-internal-title';
         var dialogContent = 'format-sdcard-internal-message';
       } else {
         var dialogHeader = 'format-sdcard-title';
         var dialogContent = 'format-sdcard-message';
       }
       var dialogConfig = {
          title: {id: dialogHeader, args: {}},
          body: {id: dialogContent, args: {}},
          cancel: {
            l10nId:'cancel',
            priority:1,
            callback: function(){
              dialog.destroy();
              evt.target.parentNode.focus();
            },
          },
          confirm: {
            l10nId:'format-sdcard-btnformat',
            priority:3,
            callback: function(){
              dialog.destroy();
              self.isFormatting = true;
              self.storages.sdcard.format();
            },
          },
        };
        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
  };

  Volume.prototype.enableFormatSDCardBtn =
    function volume_enableFormatSDCardBtn(enabled, isFormatting) {
    if (this.storages.sdcard.canBeFormatted) {
      // enable/disable button
      var formatBtn = document.querySelector('#format-sdcard');
      formatBtn.parentNode.setAttribute('aria-disabled',!enabled) ;
      if (!enabled) {
        formatBtn.parentNode.classList.add('none-select');
      } else {
        formatBtn.parentNode.classList.remove('none-select');
      }
      // update text description on button
     /* var l10nId = 'format-sdcard-' + this.getVolumeId();
      if (!enabled && isFormatting) {
        l10nId = 'formatting';
      }

      formatBtn.setAttribute('data-l10n-id', l10nId);*/
    }
  };

  var MediaStorage = {
    init: function ms_init() {
      this._volumeList = this.initAllVolumeObjects();

      this._handleExternalUnrecognisedChanged =
        this.handleExternalUnrecognisedChanged.bind(this);

      this._updateInfo = this.updateInfo.bind(this);

      this.documentStorageListener = false;
      this.usmEnabledVolume = {};
      this.umsVolumeShareState = false;

      // After updated listener, we will update information in the callback.
      this.updateListeners(this._updateInfo);

      // Use visibilitychange so that we don't get notified of device
      // storage notifications when the settings app isn't visible.
      document.addEventListener('visibilitychange', this);

      window.addEventListener('localized', this);

      this.elements = document.querySelectorAll('#mediaStorageDesc li');
      AppsCache.apps().then(function (apps) {
        apps.forEach((app) => {
          var name = app.origin;
          switch (name) {
            case 'app://music.gaiamobile.org':
              mediaApps['music'] = app;
              break;
            case 'app://gallery.gaiamobile.org':
              mediaApps['pictures'] = app;
              break;
            case 'app://video.gaiamobile.org':
              mediaApps['videos'] = app;
              break;
            case 'app://filemanager.gaiamobile.org':
              mediaApps['other'] = app;
              break;
            default:
              break;
          }
        });
      });
      this._initAllFocusEvent();
    },

    _updateSoftkey: function ms_updateSoftkey(evt) {
      var paramsWithSelect = {
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
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Open',
          l10nId: 'open',
          priority: 2,
          method: function() {
            ['music', 'pictures', 'videos', 'other'].forEach((name) => {
              if (focusedElement.classList.contains('color-' + name)) {
                mediaApps[name].launch();
              }
            });
            if (window.ActivityHandler) {
              ActivityHandler.postResult();
            }
          }
        }]
      };

      var focusedElement = document.querySelector('#volume-list .focus');
      if (focusedElement.classList.contains('color-music') ||
        focusedElement.classList.contains('color-pictures') ||
        focusedElement.classList.contains('color-videos') ||
        focusedElement.classList.contains('color-other')) {
        SettingsSoftkey.init(params);
        SettingsSoftkey.show();
      } else if (focusedElement.classList.contains('default-media-location') ||
        focusedElement.classList.contains('format-btn')) {
        SettingsSoftkey.init(paramsWithSelect);
        SettingsSoftkey.show();
      } else {
        SettingsSoftkey.hide();
      }
    },

    _initAllFocusEvent: function ms_initAllFocusEvent() {
      var i = this.elements.length - 1;
      for (i; i >= 0; i--) {
        this.elements[i].addEventListener('focus', this._updateSoftkey);
      }
    },

    initAllVolumeObjects: function ms_initAllVolumeObjects() {
      var volumes = {};
      var totalVolumes = 0;
      MEDIA_TYPE.forEach(function(type) {
        var storages = navigator.getDeviceStorages(type);
        storages.forEach(function(storage) {
          var name = storage.storageName;
          if (!volumes.hasOwnProperty(name)) {
            volumes[name] = {};
            totalVolumes++;
          }
          volumes[name][type] = storage;
        });
      });

      var volumeList = [];
      var externalIndex = 0;
      var volumeListRootElement = document.getElementById('volume-list');
      for (var name in volumes) {
        var volume;
        // XXX: This is a heuristic to determine whether a storage is internal
        // or external (e.g. a pluggable SD card). It does *not* work
        // in general, but it works for all officially-supported devices.
        if (totalVolumes === 1 || name === INTERNAL_TYPE) {
          volume = new Volume(name, false /* internal */, 0, volumes[name]);
        } else {
          volume = new Volume(name, true /* external */, externalIndex++,
                              volumes[name]);
        }
        volume.createView(volumeListRootElement);
        volumeList.push(volume);
      }
      if (totalVolumes > 1) {
        if (MediaStorage.storageType) {
          if (MediaStorage.storageType === INTERNAL_TYPE) {
            document.getElementById('sdcard1').hidden = true;
          } else {
            document.getElementById('sdcard').hidden = true;
          }
        } else {
          Settings.mozSettings.createLock().get(DEFAULT_MEDIA_KEY).then((result) => {
            var mediaType = result[DEFAULT_MEDIA_KEY];
            if (mediaType === INTERNAL_TYPE) {
              document.getElementById('sdcard1').hidden = true;
            } else {
              document.getElementById('sdcard').hidden = true;
            }
            window.dispatchEvent(new CustomEvent('refresh'));
          });
        }

      }
      return volumeList;
    },

    handleEvent: function ms_handleEvent(evt) {
      switch (evt.type) {
        case 'localized':
          this.updateInfo();
          break;
        case 'change':
          if (evt.target.id === 'ums-switch') {
            Storage.umsMasterSettingChanged(evt);
          } else {
            // we are handling storage changes
            // possible state: available, unavailable, shared
            this.updateInfo();
          }
          break;
        case 'storage-state-change':
          var storageStatus = evt.reason;
          var storageName = evt.currentTarget.storageName;
          this.updateStorageStatus(storageStatus, storageName);
          break;
        case 'visibilitychange':
          this.updateListeners(this._updateInfo);
          break;
      }
    },


    updateListeners: function ms_updateListeners(callback) {
      var self = this;
      if (document.hidden) {
        // Settings is being hidden. Unregister our change listener so we won't
        // get notifications whenever files are added in another app.
        if (this.documentStorageListener) {
          this._volumeList.forEach(function(volume) {
            // use sdcard storage to represent this volume
            var volumeStorage = volume.storages.sdcard;
            volumeStorage.removeEventListener('change', self);
            volumeStorage.removeEventListener('storage-state-change', self);
          });

          // Unobserve 'unrecognised' state for external storage.
          Settings.mozSettings.removeObserver(
            EXTERNAL_UNRECOGNISED_KEY,
            this._handleExternalUnrecognisedChanged
          );

          this.documentStorageListener = false;
        }
      } else {
        if (!this.documentStorageListener) {
          this._volumeList.forEach(function(volume) {
            // use sdcard storage to represent this volume
            var volumeStorage = volume.storages.sdcard;
            volumeStorage.addEventListener('change', self);
            volumeStorage.addEventListener('storage-state-change', self);
          });

          // Init format SD card button for unrecognised storage.
          SettingsCache.getSettings(function(allSettings) {
            var isUnrecognised = allSettings[EXTERNAL_UNRECOGNISED_KEY];
            this.enableFormatSDCardBtnForUnrecognisedStorage(isUnrecognised);
            // Update storage information after checked the storage
            // unrecognised status already.
            if (callback) {
              callback();
            }
          }.bind(this));

          // Observe 'unrecognised' state for external storage.
          Settings.mozSettings.addObserver(
            EXTERNAL_UNRECOGNISED_KEY,
            this._handleExternalUnrecognisedChanged
          );

          this.documentStorageListener = true;
        }
      }
    },

    enableFormatSDCardBtnForUnrecognisedStorage:
    function ms_enableFormatSDCardBtnForUnrecognisedStorage(enabled) {
      if (this._volumeList.length === 1) {
        // one volume only, it should be an external storage
        // enable header to display storage name
        this._volumeList[0].isUnrecognised = enabled;
        this._volumeList[0].updateStorageUIState(enabled, true);
        // enable format button
        this._volumeList[0].enableFormatSDCardBtn(enabled);
      } else if (this._volumeList.length > 1) {
        this._volumeList.forEach(function(volume) {
          // The storage name is mapping to a hard code name. Because name of
          // some external storeages are different. Such as, Flame: 'external',
          // Helix: 'extsdcard'.
          if (volume.external) {
            // External
            // enable header to display storage name
            volume.isUnrecognised = enabled;
            volume.updateStorageUIState(enabled, true);
            // enable format button
            volume.enableFormatSDCardBtn(enabled);
          }
        }.bind(this));
      }
    },

    handleExternalUnrecognisedChanged:
    function ms_handleExternalUnrecognisedChanged(event) {
      this.enableFormatSDCardBtnForUnrecognisedStorage(event.settingValue);
    },

    updateInfo: function ms_updateInfo() {
      var self = this;
      this.umsVolumeShareState = false;
      this._volumeList.forEach(function(volume) {
        volume.updateInfo(function(state) {
          if (state === 'shared') {
            self.umsVolumeShareState = true;
          }
        });
      });
    },

    // update storage status corresponding to each volume storage
    updateStorageStatus:
    function ms_updateStorageStatus(storageStatus, storageName) {
      if (this._volumeList.length === 1) {
        // one volume only, so fire event to the volume instance directly
        this._volumeList[0].currentStorageStatus = storageStatus;
        this._volumeList[0].updateUIState(storageStatus);
      } else if (this._volumeList.length > 1) {
        this._volumeList.forEach(function(volume) {
          // The storage name is mapping to a hard code name. Because name of
          // some external storeages are different. Such as, Flame: 'external',
          // Helix: 'extsdcard'.
          if ((storageName !== INTERNAL_TYPE) && volume.external) {
            // External
            volume.currentStorageStatus = storageStatus;
            volume.updateUIState(storageStatus);
          } else if ((storageName === 'sdcard') && !volume.external) {
            // Internal
            volume.currentStorageStatus = storageStatus;
            volume.updateUIState(storageStatus);
          }
        }.bind(this));
      }
    }
  };

  var StackedBar = function(div) {
    var container = div;
    var items = [];
    var totalSize = 0;
    var clientWidth = container.clientWidth;

    return {
      add: function sb_add(item) {
        totalSize += item.value;
        items.push(item);
      },

      refreshUI: function sb_refreshUI() {
        container.parentNode.setAttribute('aria-disabled', false);
        container.parentNode.classList.remove('none-select');
        container.hidden = false;
        let totalWidths = 100;
        items.sort((a, b) => {
          a = a.value;
          b = b.value;
          return a - b;
        });
        items.forEach(function(item) {
          let width = 0;
          if ((item.value > 0) &&
            ((item.value * 100) / totalSize) < (1 * 100 / clientWidth)) {
            width =  1 * 100 / clientWidth ;
          } else {
            width = (item.value * 100) / totalSize;
          }
          if (width < totalWidths) {
            totalWidths = totalWidths - width;
          } else {
            width = totalWidths;
            totalWidths = 0;
          }
          item.width = width;
        });

        let results = []
        for (let i = 0; i < ITEM_TYPE.length; i++) {
          results = results.concat(items.filter(m => m.type === ITEM_TYPE[i]))
        }
        results.forEach(function(item) {
          var className = 'color-' + item.type;
          var ele = container.querySelector('.' + className);
          if (!ele) {
            ele = document.createElement('span');
            ele.classList.add(className);
            ele.classList.add('stackedbar-item');
            container.appendChild(ele);
          }
          ele.style.width = item.width + '%';
        });
      },

      reset: function sb_reset() {
        items = [];
        totalSize = 0;
        container.parentNode.setAttribute('aria-disabled', true);
        container.parentNode.classList.add('none-select');
        container.hidden = true;
      }
    };
  };
   module.exports = MediaStorage;
});
