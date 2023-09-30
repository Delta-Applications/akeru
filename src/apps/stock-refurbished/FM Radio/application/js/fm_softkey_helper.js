/* exported FMSoftkeyHelper */
'use strict';

(function(exports) {

  // Handle soft key 'allstations' clicked
  function onSoftkeyAllStationsClicked() {
    StationsList.switchToStationListUI();
  }

  // Handle soft key 'favorites' clicked
  function onSoftkeyFavoritesClicked() {
    StationsList.switchToFavoriteListUI();
  }

  // Handle soft key 'cancel' clicked
  function onSoftkeyCancelClicked() {
    FavoriteEditor.undoRename();
    FavoriteEditor.switchToFrequencyListUI();
  }

  // Handle soft key 'not-now' clicked
  function onSoftkeyNotNowClicked() {
    FMSoftkeyHelper.hideDialog();
    StatusManager.update(StatusManager.STATUS_FAVORITE_SHOWING);
  }

  // Handle soft key 'turn-on' clicked
  function onSoftkeyPlayClicked() {
    FMRadio.enableFMRadio(FrequencyDialer.getFrequency());
  }

  // Handle soft key 'turn-off' clicked
   function onSoftkeyStopClicked() {
    FMRadio.disableFMRadio();
  }

  // Handle soft key 'default-ok' clicked
  function onSoftkeyDefaultCSKClicked() {
    if (!(FMElementAntennaUnplugWarning.hidden && FMElementAirplaneModeWarning.hidden)) {
      FMElementAntennaUnplugWarning.hidden = true
      FMElementAirplaneModeWarning.hidden = true
      //window.close();
    }
  }

  // Handle soft key 'save-ok' clicked
  function onSoftkeySaveCSKClicked() {
    FavoriteEditor.saveRename();
    FavoriteEditor.switchToFrequencyListUI();
  }

  // Handle soft key 'abort' clicked
  function onSoftkeyAbortClicked() {
    StationsList.abortScanStations(false);
  }

  // Handle soft key 'scan' clicked
  function onSoftkeyScanClicked() {
    // Hide dialog and update current status first
    FMSoftkeyHelper.hideDialog();
    StatusManager.update(StatusManager.STATUS_FAVORITE_SHOWING);
    StationsList.switchToStationListUI();
  }

  // Handle soft key 'settings' clicked
  function onSoftkeySettingsClicked () {
    try {
      new MozActivity({
        name: 'configure',
        data: {
          target: 'device',
          section: 'connectivity-settings'
        }
      });
    } catch (e) {
      console.error('Failed to create an activity: ' + e);
    }
  }

  // Handle soft key 'volume' clicked
  function onSoftkeyVolumeClicked() {
    if (typeof FMVolumeManager === 'undefined') {
      LazyLoader.load('js/fm_volume_manager.js', () => {
        FMVolumeManager.requestVolume('show');
      });
    } else {
      FMVolumeManager.requestVolume('show');
    }
  }

  // Handle soft key 'add-to-favorites' clicked
  function onSoftkeyAddToFavoritesClicked() {
    if (StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING) {
      // Update current frequency as favorite to data base
      FrequencyManager.updateFrequencyFavorite(FrequencyDialer.getFrequency(), true);
      // Update favorite list UI
      FrequencyList.updateFavoriteListUI();
      // Update frequency dialer UI
      FrequencyDialer.updateFrequency();
      WarningUI.update();
      FocusManager.update(); 
    } else if (StatusManager.status === StatusManager.STATUS_STATIONS_SHOWING) {
      // Update current frequency as favorite to data base,
      // and mark current frequency is a station
      FrequencyManager.updateFrequencyFavorite(FrequencyDialer.getFrequency(), true, true);
      // Just update current frequency element is OK
      var currentFocusedElement = FocusManager.getCurrentFocusElement();
      FrequencyList.updateCurrentFrequencyElement(currentFocusedElement);
    }

    // Show toast to notice add to favorite success
    FMRadio.showMessage('tcl-station-added');
    // Update status to update softkeys
    StatusManager.update();
  }

  // Handle soft key 'unfavorite' clicked
  function onSoftkeyUnfavoriteClicked() {
    if (StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING) {
      // Update current frequency as unfavorite to data base
      FrequencyManager.updateFrequencyFavorite(FrequencyDialer.getFrequency(), false);
      // Update favorite list UI
      FrequencyList.updateFavoriteListUI();
      WarningUI.update();
      FocusManager.update();
    } else if (StatusManager.status === StatusManager.STATUS_STATIONS_SHOWING) {
      // Update current frequency as unfavorite to data base,
      // and mark current frequency is a station
      FrequencyManager.updateFrequencyFavorite(FrequencyDialer.getFrequency(), false, true);
      // Just update current frequency element is OK
      var currentFocusedElement = FocusManager.getCurrentFocusElement();
      FrequencyList.updateCurrentFrequencyElement(currentFocusedElement);
    }

    // Show toast to notice add to favorite success
    FMRadio.showMessage('tcl-station-removed');
    // Update status to update softkeys
    StatusManager.update();
  }

  // Handle soft key 'rename' clicked
  function onSoftkeyRenameClicked() {
    // Load favorite_editor.js if needed
    if (typeof FavoriteEditor === 'undefined') {
      LazyLoader.load('js/favorite_editor.js', () => {
        FavoriteEditor.switchToRenameModeUI();
        FavoriteEditor.renameFavorite();
      });
    } else {
      FavoriteEditor.switchToRenameModeUI();
      FavoriteEditor.renameFavorite();
    }
  }

  // Handle soft key 'scan-stations' clicked
  function onSoftkeyScanStationsClicked() {
    StationsList.startScanStations();
  }

  // Handle soft key 'switchToHeadphones' clicked
  function onSoftkeySwitchToHeadphonesClicked() {
    SpeakerState.state = false;
  }

  // Handle soft key 'switchToSpeaker' clicked
  function onSoftkeySwitchToSpeakerClicked() {
    SpeakerState.state = true;
  }

  // Indicate soft key and corresponding handle function mapping table
  var FunctionList = {
    'allstations':        onSoftkeyAllStationsClicked,
    'favorites':          onSoftkeyFavoritesClicked,
    'cancel':             onSoftkeyCancelClicked,
    'not-now':            onSoftkeyNotNowClicked,
    'turn-on':            onSoftkeyPlayClicked,
    'turn-off':           onSoftkeyStopClicked,
    'default-ok':         onSoftkeyDefaultCSKClicked,
    'save-ok':            onSoftkeySaveCSKClicked,
    'abort':              onSoftkeyAbortClicked,
    'scan':               onSoftkeyScanClicked,
    'settings':           onSoftkeySettingsClicked,
    'volume':             onSoftkeyVolumeClicked,
    'add-to-favorites':   onSoftkeyAddToFavoritesClicked,
    'unfavorite':         onSoftkeyUnfavoriteClicked,
    'rename':             onSoftkeyRenameClicked,
    'scan-stations':      onSoftkeyScanStationsClicked,
    'switchToHeadphones': onSoftkeySwitchToHeadphonesClicked,
    'switchToSpeaker':    onSoftkeySwitchToSpeakerClicked,
  };

  // FMSoftkeyHelper Constructor
  function FMSoftkeyHelper() {};

  // Initialize FMSoftkeyHelper
  FMSoftkeyHelper.prototype.init = function() {
    this.isLongPress = false;
    this.timerScanStation = null;
    this.timerContinueScan = null;
    this.volumeIsAdjusting = false;
    this.keyDownFreezeTimeout = null;
    this.isMicrophoneToggle = false;

    this.softkeyLSKId = null;
    this.softkeyCSKId = null;
    this.softkeyRSKIds = null;
    this.fmSoftkeyMenuList = null;
    this.headerTitleId = null;

    this.fmSoftkeyLeft = document.getElementById('fm-softkey-left');
    this.fmSoftkeyCenter = document.getElementById('fm-softkey-center');
    this.fmSoftkeyRight = document.getElementById('fm-softkey-right');
    this.fmSoftkeyMenuPanel = document.querySelector('.fm-softkey-menu');
    this.fmSoftkeyMenuContainer = document.querySelector('.fm-softkey-menu-container');
    this.fmHeaderTitle = document.querySelector('#fm-header h1');

    this.fmDialogContainer = document.querySelector('.dialog-container');
    this.fmDialogContent = this.fmDialogContainer.querySelector('.content');

    window.addEventListener('keydown', this.handleKeyDown.bind(this), false);
    window.addEventListener('keyup', this.handleKeyUp.bind(this), false);
    window.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this), false);
  };
  // Handle FM Radio key down, and send operation to the corresponding handle function
  FMSoftkeyHelper.prototype.handleKeyDown = function(e) {
    if (this.keyDownFreezeTimeout && !this.isMicrophoneToggle) {
      return;
    }



    this.keyDownFreezeTimeout = setTimeout(function() {
      clearTimeout(this.keyDownFreezeTimeout);
      this.keyDownFreezeTimeout = null;
      this.isMicrophoneToggle = false;
    }.bind(this), 200);

    var isRtl = document.documentElement.dir === 'rtl';
    var fmSoftkeyPanelVisible = this.isSoftkeyMenuPanelVisible();
    switch (e.key) {
      case 'Backspace':
      case 'BrowserBack':
        if (fmSoftkeyPanelVisible) {
          // Hide soft key panel first if visible
          this.hideSoftkeyMenuPanel();
          e.preventDefault();
        } else if (StatusManager.status === StatusManager.STATUS_FAVORITE_RENAMING) {
          FavoriteEditor.undoRename();
          FavoriteEditor.switchToFrequencyListUI();
          e.preventDefault();
        } else if (StatusManager.status === StatusManager.STATUS_STATIONS_SCANING) {
          StationsList.scanAbortOnBrowserBack();
          e.preventDefault();
        } else {
          if (FocusManager!=undefined && FocusManager!=null && FocusManager.backOff) {
            if (!(StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING)) {
              this.beforeLeaving();
              e.preventDefault()
            }
          } else {
            this.beforeLeaving();
            e.preventDefault();
          }
        }
        break;
      case 'EndCall':
        if (fmSoftkeyPanelVisible) {
          // Hide soft key panel first if visible
          this.hideSoftkeyMenuPanel();
          e.preventDefault();
        } else {
          this.beforeLeaving();
        }
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (!fmSoftkeyPanelVisible && mozFMRadio.enabled
          && (StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING)) {
          if (!this.timerScanStation) {
            this.timerScanStation = setTimeout(function() {
              this.isLongPress = true;
              this.startStationScan((e.key === 'ArrowLeft') === isRtl);
            }.bind(this), 500);
          }
        }
        break;
      case 'ArrowUp':
        if (fmSoftkeyPanelVisible) {
          // Switch to the next option menu item
          // if soft key option panel visible
          this.nextSoftkeyMenuItem(false);
        } else if (this.volumeIsAdjusting) {
          FMVolumeManager.requestVolume('up');
        } else if (this.checkIfShouldChangeFocus()) {
          // Focus the next list item
          FocusManager.focusNext(false);
          StatusManager.update();
        }
        e.preventDefault();
        break;
      case 'ArrowDown':
        if (fmSoftkeyPanelVisible) {
          // Switch to the next option menu item
          // if soft key option panel visible
          this.nextSoftkeyMenuItem(true);
        } else if (this.volumeIsAdjusting) {
          FMVolumeManager.requestVolume('down');
        } else if (this.checkIfShouldChangeFocus()) {
          // Focus the next list item
          FocusManager.focusNext(true);
          StatusManager.update();
        }
        e.preventDefault();
        break;
      case 'SoftLeft':
        if (!fmSoftkeyPanelVisible) {
          this.onSoftkeyLeftClicked();
        }
        break;
      case 'SoftRight':
        if (!fmSoftkeyPanelVisible) {
          this.onSoftkeyRightClicked();
        }
        break;
      case 'MicrophoneToggle':
          this.isMicrophoneToggle = true;
          break;
      case 'Enter':
        FMElementAntennaUnplugWarning.hidden = true

        if (StatusManager.status === StatusManager.STATUS_WARNING_SHOWING) {
          if (window.closeFMResolve) {
            window.addEventListener("visibilitychange", () => {
              return window.closeFMResolve();
            })
          } else {
            new Promise(resolve => {
              window.closeFMResolve = resolve;
            }).then(() => {
              window.closeFMResolve = null;
              this.onSoftkeyCenterClicked();
            })
          }
          break;
        }
        if (fmSoftkeyPanelVisible) {
          // Select the current option menu item
          this.hideSoftkeyMenuPanel();
          this.onSoftkeyMenuItemSelected();
        } else {
          this.onSoftkeyCenterClicked();
        }
        break;
      case 'HeadsetHook':
        event.preventDefault();
        event.stopPropagation();
        break;
      default:
        break;
    }
  };

  FMSoftkeyHelper.prototype.handleKeyUp = function(e) {
    var isRtl = 'rtl' === document.documentElement.dir;
    var arrowKeys = isRtl ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];

    // Do not response anything if option menu is shown
    if (this.isSoftkeyMenuPanelVisible()) {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        // Only when FMRadio is enabled and showing favorite list UI
        if (mozFMRadio.enabled && (StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING)) {
          this.clearScanTimer();

          if (!this.isLongPress) {
            var frequency = mozFMRadio.frequency;
            frequency = e.key === arrowKeys[0] ? frequency - 0.1 : frequency + 0.1;
            if (e.key === arrowKeys[0] && frequency < mozFMRadio.frequencyLowerBound) {
              mozFMRadio.setFrequency(mozFMRadio.frequencyUpperBound);
            } else if (e.key === arrowKeys[1] && frequency > mozFMRadio.frequencyUpperBound) {
              mozFMRadio.setFrequency(mozFMRadio.frequencyLowerBound);
            } else {
              mozFMRadio.setFrequency(frequency);
            }
          } else {
            mozFMRadio.cancelSeek();
          }
          this.isLongPress = false;
        }
        break;
      case 'Enter':
        if (StatusManager.status === StatusManager.STATUS_WARNING_SHOWING) {
          if (window.closeFMResolve) {
            window.closeFMResolve = null;
            this.onSoftkeyCenterClicked();
          }
        }
        break;
      default:
        break;
    }
  };

  FMSoftkeyHelper.prototype.startStationScan = function(seekUpDirection) {
    if (this.timerScanStation) {
      var request = seekUpDirection ? mozFMRadio.seekUp() : mozFMRadio.seekDown();
      request.onsuccess = function() {
        this.timerContinueScan = setTimeout(function() {
          this.startStationScan(seekUpDirection);
        }.bind(this), 1500);
      }.bind(this);
    }
  };

  FMSoftkeyHelper.prototype.checkIfShouldChangeFocus = function() {
      return mozFMRadio.enabled
        && ((StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING)
          || (StatusManager.status === StatusManager.STATUS_STATIONS_SHOWING));
  };

  // Handle LSK clicked
  FMSoftkeyHelper.prototype.onSoftkeyLeftClicked = function() {
    this.callFunctionByCurrentElementL10Id(this.fmSoftkeyLeft);
  };

  // Handle CSK clicked
  FMSoftkeyHelper.prototype.onSoftkeyCenterClicked = function() {
    this.callFunctionByCurrentElementL10Id(this.fmSoftkeyCenter);
  };

  // Handle RSK clicked
  FMSoftkeyHelper.prototype.onSoftkeyRightClicked = function() {
    if (!this.softkeyRSKIds || this.softkeyRSKIds.length === 0) {
      return;
    }

    if (this.softkeyRSKIds.length === 1) {
      this.callFunctionByCurrentElementL10Id(this.fmSoftkeyRight);
    } else {
      this.showSoftkeyMenuPanel();
    }
  };

  // Handle the current focused option menu item clicked
  FMSoftkeyHelper.prototype.onSoftkeyMenuItemSelected = function() {
    var currentMenuItem = this.fmSoftkeyMenuList.querySelector('.current');
    this.callFunctionByCurrentElementL10Id(currentMenuItem);
  };

  // Find and call the handle function from the mapping table
  FMSoftkeyHelper.prototype.callFunctionByCurrentElementL10Id = function(element) {
    var l10nId = element.getAttribute('data-l10n-id');
    FunctionList[l10nId]();
  };

  // Find and focus the next option menu item
  FMSoftkeyHelper.prototype.nextSoftkeyMenuItem = function(next) {
    var currentMenuItem = this.fmSoftkeyMenuList.querySelector('.current');
    var nextMenuItem = next ? currentMenuItem.nextSibling : currentMenuItem.previousSibling;
    if (!nextMenuItem) {
      nextMenuItem = next ? this.fmSoftkeyMenuList.firstChild : this.fmSoftkeyMenuList.lastChild;
    }
    currentMenuItem.classList.remove('current');
    nextMenuItem.classList.add('current');
    nextMenuItem.scrollIntoView(false);
    nextMenuItem.focus();
  };

  // Add current option menu item to option menu panel
  FMSoftkeyHelper.prototype.addSoftkeyMenuItem = function(l10nId) {
    var menuItemElement = document.createElement('button');
    menuItemElement.classList.add('fm-softkey-menu-item');
    menuItemElement.classList.add('p-pri');
    menuItemElement.setAttribute('data-l10n-id', l10nId);
    return menuItemElement;
  };

  // Show and update option menu panel
  FMSoftkeyHelper.prototype.showSoftkeyMenuPanel = function() {
    this.fmSoftkeyMenuContainer.innerHTML = '';

    var menuListHeader = document.createElement('h1');
    menuListHeader.classList.add('fm-softkey-menu-header');
    menuListHeader.setAttribute('data-l10n-id', 'options');
    this.fmSoftkeyMenuContainer.appendChild(menuListHeader);

    if (!this.fmSoftkeyMenuList) {
      this.fmSoftkeyMenuList = document.createElement('menu');
      this.fmSoftkeyMenuList.id = 'option-menu';
    } else {
      this.fmSoftkeyMenuList.innerHTML = '';
    }
    for (var index in this.softkeyRSKIds) {
      var menuItemElement = this.addSoftkeyMenuItem(this.softkeyRSKIds[index]);
      this.fmSoftkeyMenuList.appendChild(menuItemElement);
    }
    this.fmSoftkeyMenuList.children[0].classList.add('current');
    this.fmSoftkeyMenuContainer.appendChild(this.fmSoftkeyMenuList);
    var position = this.fmSoftkeyMenuList.children[0].height * this.fmSoftkeyMenuList.children.length;
    menuListHeader.setAttribute('style', 'bottom:' + position + 'px');

    this.showSoftkeys(null, 'select', null);
    this.fmSoftkeyMenuPanel.classList.add('visible');
    this.fmSoftkeyMenuPanel.focus();

    // take focus for accessibility
    let currentMenuItem = this.fmSoftkeyMenuList.querySelector('.current');
    if (currentMenuItem) {
      currentMenuItem.focus();
    }
  };

  // Hide option menu panel
  FMSoftkeyHelper.prototype.hideSoftkeyMenuPanel = function() {
    this.showSoftkeys(this.softkeyLSKId, this.softkeyCSKId, this.softkeyRSKIds);
    this.fmSoftkeyMenuPanel.classList.remove('visible');
  };

  // Check option menu panel is vasible current ly
  FMSoftkeyHelper.prototype.isSoftkeyMenuPanelVisible = function() {
    return this.fmSoftkeyMenuPanel.classList.contains('visible');
  };

  // Update LSK
  FMSoftkeyHelper.prototype.updateSoftkeyLeft = function(status) {
    if (!mozFMRadio.enabled) {
      return;
    }

    switch (status) {
      case StatusManager.STATUS_FAVORITE_SHOWING:
        return 'allstations';
      case StatusManager.STATUS_FAVORITE_RENAMING:
        return 'cancel';
      case StatusManager.STATUS_STATIONS_SHOWING:
        return 'favorites';
      case StatusManager.STATUS_DIALOG_FIRST_INIT:
        return 'not-now';
      case StatusManager.STATUS_WARNING_SHOWING:
      case StatusManager.STATUS_STATIONS_SCANING:
      default:
        return;
    }
  };

  // Update CSK
  FMSoftkeyHelper.prototype.updateSoftkeyCenter = function(status) {
    switch (status) {
      case StatusManager.STATUS_WARNING_SHOWING:
        return 'default-ok';
      case StatusManager.STATUS_FAVORITE_SHOWING:
      case StatusManager.STATUS_STATIONS_SHOWING:
        return mozFMRadio.enabled ? 'turn-off' : 'turn-on';
      case StatusManager.STATUS_FAVORITE_RENAMING:
        return 'save-ok';
      case StatusManager.STATUS_STATIONS_SCANING:
      case StatusManager.STATUS_DIALOG_FIRST_INIT:
      default:
        return;
    }
  };

  // Update RSK
  FMSoftkeyHelper.prototype.updateSoftkeyRight = function(status) {
    var softkeyIds = [];
    switch (status) {
      case StatusManager.STATUS_FAVORITE_SHOWING:
      case StatusManager.STATUS_STATIONS_SHOWING:
        if (!mozFMRadio.enabled) {
          return;
        }

        if (!FMRadio.deviceWithVolumeHardwareKey) {
          softkeyIds.push('volume');
        }

        if (FrequencyManager.checkFrequencyIsFavorite(FrequencyDialer.getFrequency())) {
          softkeyIds.push('unfavorite');
        } else {
          softkeyIds.push('add-to-favorites');
        }

        if (StatusManager.status === StatusManager.STATUS_STATIONS_SHOWING) {
          softkeyIds.push('scan-stations');
        }

        // when current frequency exist in StationList, add the option rename
        const currentFrequency = FrequencyDialer.getFrequency();
        if (FrequencyManager.checkFrequencyIsStation(currentFrequency) || FrequencyManager.checkFrequencyIsFavorite(currentFrequency)) {
          softkeyIds.push('rename');
        }

        if (!HeadphoneState.deviceWithInternalAntenna) {
          softkeyIds.push(SpeakerState.state ? 'switchToHeadphones' : 'switchToSpeaker');
        }
        break;
      case StatusManager.STATUS_STATIONS_SCANING:
        softkeyIds.push('abort');
        break;
      case StatusManager.STATUS_DIALOG_FIRST_INIT:
        softkeyIds.push('scan');
        break;
      case StatusManager.STATUS_WARNING_SHOWING:
        if (FMRadio.airplaneModeEnabled) {
          softkeyIds.push('settings');
        }
        break;
      case StatusManager.STATUS_FAVORITE_RENAMING:
      default:
        break;
    }
    return softkeyIds;
  };

  // Show and update current soft keys
  FMSoftkeyHelper.prototype.showSoftkeys = function(lsk, csk, rsk) {
    this.updateSoftkey(this.fmSoftkeyLeft, lsk);
    this.updateSoftkey(this.fmSoftkeyCenter, csk);
    this.updateSoftkey(this.fmSoftkeyRight, (rsk && rsk.length !== 0)
      ? ((rsk.length === 1) ? rsk[0] : 'options') : undefined);
  };

  FMSoftkeyHelper.prototype.updateSoftkey = function(softkey, l10nId) {
    if (!l10nId) {
      softkey.removeAttribute('data-l10n-id');
      softkey.textContent = '';
    } else {
      softkey.setAttribute('data-l10n-id', l10nId);
    }
  };

  // Show dialog
  FMSoftkeyHelper.prototype.showDialog = function(l10nId) {
    this.hideDialog();
    this.fmDialogContent.setAttribute('data-l10n-id', l10nId);
    this.fmDialogContainer.classList.remove('hidden');
    this.fmDialogContainer.focus();
  };

  // Hide dialog
  FMSoftkeyHelper.prototype.hideDialog = function() {
    if (!this.fmDialogContainer.classList.contains('hidden')) {
      this.fmDialogContainer.classList.add('hidden');
    }
  };

  // Update soft keys
  FMSoftkeyHelper.prototype.updateSoftkeys = function() {
    var status = StatusManager.status;
    var lsk = this.updateSoftkeyLeft(status);
    var csk = this.updateSoftkeyCenter(status);
    var rsk = this.updateSoftkeyRight(status);

    this.softkeyLSKId = lsk;
    this.softkeyCSKId = csk;
    this.softkeyRSKIds = rsk;
    this.showSoftkeys(lsk, csk, rsk);

    if (FrequencyList.updateCache) {
      FMRadio.saveCache();
      FrequencyList.updateCache = false;
    }
  };

  // Update header title
  FMSoftkeyHelper.prototype.updateHeaderTitle = function (status) {
    var title = '';
    switch (StatusManager.status) {
      case StatusManager.STATUS_FAVORITE_SHOWING:
      case StatusManager.STATUS_DIALOG_FIRST_INIT:
      case StatusManager.STATUS_WARNING_SHOWING:
        title = 'tcl-fm-radio';
        break;
      case StatusManager.STATUS_FAVORITE_RENAMING:
        title = 'rename';
        break;
      case StatusManager.STATUS_STATIONS_SHOWING:
        title = 'allstations';
        break;
      case StatusManager.STATUS_STATIONS_SCANING:
        title = 'tcl-stations-scanning';
        break;
      default:
        return;
    }

    this.fmHeaderTitle.setAttribute('data-l10n-id', title);
  };

  FMSoftkeyHelper.prototype.beforeLeaving = function() {
    if (!mozFMRadio.enabled) {
      window.close();
      return;
    }

    if (this.isSoftkeyMenuPanelVisible()) {
      this.hideSoftkeyMenuPanel();
    }

    // Make sure FMRadio show favorite list UI before leaving FMRadio
    if (StatusManager.status === StatusManager.STATUS_FAVORITE_SHOWING) {
      FocusManager.update();
    } else if (StatusManager.status === StatusManager.STATUS_FAVORITE_RENAMING) {
      FavoriteEditor.undoRename();
      FavoriteEditor.switchToFrequencyListUI();
    } else if (StatusManager.status === StatusManager.STATUS_STATIONS_SHOWING) {
      StationsList.switchToFavoriteListUI();
    }
  };

  FMSoftkeyHelper.prototype.handleVisibilityChange = function () {
    if (document.hidden) {
      mozFMRadio.cancelSeek();
      this.isLongPress = false;
      this.clearScanTimer();
    }
  };

  FMSoftkeyHelper.prototype.clearScanTimer = function () {
    if (this.timerScanStation) {
      clearTimeout(this.timerScanStation);
      this.timerScanStation = null;
    }
    if (this.timerContinueScan) {
      clearTimeout(this.timerContinueScan);
      this.timerContinueScan = null;
    }
  };

  var FMSoftkeyHelper = new FMSoftkeyHelper();
  exports.FMSoftkeyHelper = FMSoftkeyHelper;
})(window);
