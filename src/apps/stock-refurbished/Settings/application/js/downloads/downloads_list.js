/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/*
 * This file is in charge of rendering & update the list of downloads.
 */



(function(exports) {
  var SettingsService = require('modules/settings_service');
  // Panels
  var downloadsContainer = null;
  var emptyDownloadsContainer = null;
  var downloadsPanel = null;
  var selectnumber = null;

  // Menus
  var downloadsEditMenu = null;

  // Buttons
  var editButton = null;
  var deleteButton = null;
  var selectAllButton = null;
  var deselectAllButton = null;

  // Not related with DOM vars
  var isEditMode = false;
  var numberOfDownloads = 0;
  var numberOfCheckedDownloads = 0;

  var optionsShow = false;
  var deleteCount = 0;
  var resumeClick = {};
  var isMutilDelEditMode = false;

  //add all the soft key
  var skWallpaper = {
    name: 'Set as Wallpaper',
    l10nId: 'set-as-wallpaper',
    priority: 5,
    method: function() {
      _thirdAppDoDownloadActions('wallpaper');
    }
  };
  var skShare = {
    name: 'Share',
    l10nId: 'share',
    priority: 5,
    method: function() {
      _thirdAppDoDownloadActions('share');
    }
  };
  var skSelMulti = {
    name: 'Multiple Select',
    l10nId: 'multiple-select',
    priority: 5,
    method: function() {
      //_selectAllSoftKeyhandler();
      enterMultDelMode();
    }
  };
  var skDelete = {
    name: 'Delete',
    l10nId: 'delete',
    priority: 5,
    method: function() {
      _optionDelSingleDownload();
    }
  };
  var skRingtone = {
    name: 'Set as Ringtone',
    l10nId: 'set-as-ringtone',
    priority: 5,
    method: function() {
      _thirdAppDoDownloadActions('ringtone');
    }
  };
  var skCOpen = {
    name: 'Open',
    l10nId: 'download-open',
    priority: 2,
    method: function() {
      _thirdAppDoDownloadActions('open');
    }
  };
  var skCStop = {
    name: 'Stop',
    l10nId: '',
    icon: 'stop',
    priority: 2,
    method: function() {
      _softDownloadHandler('stop');
    }
  };
  var skCResume = {
    name: 'Resume',
    l10nId: '',
    icon: 'file-download-01',
    priority: 2,
    method: function() {
      _softDownloadHandler('resume');
    }
  };
  var skCRetry = {
    name: 'Retry',
    l10nId: 'download-retry',
    priority: 2,
    method: function() {
      _softDownloadHandler();
    }
  };
  var skLSelAll = {
    name: 'Select All',
    l10nId: 'selectall',
    priority: 1,
    method: function() {
      _selectAllSoftKeyhandler();
    }
  };
  var skLDelete = {
    name: 'Delete',
    l10nId: 'delete',
    priority: 3,
    method: function() {
      _deleteSoftKeyhandler();
    }
  };
  var skLDeSele = {
    name: 'Deselect All',
    l10nId: 'deselectnone',
    priority: 1,
    method: function() {
      _deSelectAllSoftKeyhandler();
    }
  };

  var skCSelect = {
    name: 'Select',
    l10nId: 'select',
    priority: 2,
    method: function() {
    }
  };

  var skDeSelect = {
    name: 'Deselect',
    l10nId: 'deselect',
    priority: 2,
    method: function() {
    }
  };

  var skLCancel = {
    name: '',
    l10nId: '',
    priority: 1,
    method: function() {
    }
  };

  var noDownloadsSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skLCancel]
  };

  var succeeMusicSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCOpen, skShare, skRingtone, skSelMulti, skDelete]
  };
  var succeeMusicSoftKeyBarForLite = {
    header: {
      l10nId: 'options'
    },
    items: [skCOpen, skShare, skSelMulti, skDelete]
  };
  var succeeWallpaperSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCOpen, skShare, skWallpaper, skSelMulti, skDelete]
  };
  var succeeNosupportSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCOpen, skShare, skSelMulti, skDelete]
  };
  var downloadingMusicSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCStop, skShare, skRingtone, skSelMulti, skDelete]
  };
  var downloadingMusicSoftKeyBarForLite = {
    header: {
      l10nId: 'options'
    },
    items: [skCStop, skShare, skSelMulti, skDelete]
  };
  var downloadingWallpaperSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCStop, skShare, skWallpaper, skSelMulti, skDelete]
  };
  var downloadingNosupportSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCStop, skShare, skSelMulti, skDelete]
  };
  var stoppedMusicSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCResume, skShare, skRingtone, skSelMulti, skDelete]
  };
  var stoppedMusicSoftKeyBarForLite = {
    header: {
      l10nId: 'options'
    },
    items: [skCResume, skShare, skSelMulti, skDelete]
  };
  var stoppedWallpaperSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCResume, skShare, skWallpaper, skSelMulti, skDelete]
  };
  var stoppedNosupportSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCResume, skShare, skSelMulti, skDelete]
  };
  var failedMusicSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCRetry, skShare, skRingtone, skSelMulti, skDelete]
  };
  var failedMusicSoftKeyBarForLite = {
    header: {
      l10nId: 'options'
    },
    items: [skCRetry, skShare, skSelMulti, skDelete]
  };
  var failedWallpaperSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCRetry, skShare, skWallpaper, skSelMulti, skDelete]
  };
  var failedNosupportSoftKeyBar = {
    header: {
      l10nId: 'options'
    },
    items: [skCRetry, skShare, skSelMulti, skDelete]
  };
  var editSoftKeyBar1 = {
    header: {
      l10nId: 'options'
    },
    items: [skLSelAll, skCSelect]
  };
  var editSoftKeyBar2 = {
    header: {
      l10nId: 'options'
    },
    items: [skLSelAll, skCSelect, skLDelete]
  };
  var editSoftKeyBar3 = {
    header: {
      l10nId: 'options'
    },
    items: [skLDeSele, skCSelect, skLDelete]
  };
  var editSoftKeyBar4 = {
    header: {
      l10nId: 'options'
    },
    items: [skLSelAll, skDeSelect, skLDelete]
  };
  var editSoftKeyBar5 = {
    header: {
      l10nId: 'options'
    },
    items: [skLDeSele, skDeSelect, skLDelete]
  };
  //add all the menu handler open share ringtone
  function _thirdAppDoDownloadActions(name) {
    var focusedElement = document.querySelector('#downloads .focus1');
    if (focusedElement === null) {
      focusedElement = document.querySelector('#downloads .focus');
    }
    var downloadID = focusedElement.id;
    var download = DownloadApiManager.getDownload(downloadID);
    //SettingsSoftkey.hide();
    var req = DownloadHelper[name](download);
    req.onerror = function() {
      DownloadHelper.handlerError(req.error, download, function removed(d) {
        if (!d) {
          return;
        }
        // If error when opening, we need to delete it!
        var downloadId = DownloadItem.getDownloadId(d);
        var elementToDelete = _getElementForId(downloadId);
        DownloadApiManager.deleteDownloads(
          [{
            id: downloadId,
            force: true // deleting download without confirmation
          }],
          function onDeleted() {
            _removeDownloadsFromUI([elementToDelete], 1);
            _checkEmptyList();
          },
          function onError() {
            console.warn('Download not removed during launching');
          }
        );
      });

    };
    req.onsuccess = function(result) {
      if (name === 'open' && result.target.result &&
        result.target.result.deleteFile) {
        var deleteItem = _getElementForId(downloadID);
        DownloadApiManager.deleteDownloads(
          [{
            id: downloadID,
            force: true // deleting download without confirmation
          }],
          function onDeleted() {
            _removeDownloadsFromUI([deleteItem], 1);
            _checkEmptyList();
          },
          function onError() {
            console.warn('Download not removed during launching');
          }
        );
      }
    };
  }
  //to pause stop resume the downloads
  function _softDownloadHandler(actionString) {
    var focusedElement = document.querySelector('#downloads .focus');
    var downloadID = focusedElement.id;
    var download = DownloadApiManager.getDownload(downloadID);
    _actionHandler(download, actionString);
    _checkShowSoftKey();
  }
  //to delete one download frome the option menue
  function _optionDelSingleDownload() {
    //var downloadsChecked = _getAllChecked() || [];
    var focusedElement = document.querySelector('#downloads .focus');
    if (focusedElement == null) {
      focusedElement = document.querySelector('#downloads .focus1');
    }
    var focusedNext = focusedElement.nextSibling;
    var downloadID = focusedElement.id;
    var download = DownloadApiManager.getDownload(downloadID);
    var downloadItems = [],
      downloadElements = {};
    downloadItems.push({
      id: downloadID,
      force: false
    });
    downloadElements[downloadID] = focusedElement;

    function deletionDone() {
      _checkEmptyList();
    }

    function doDeleteDownloads() {
      DownloadApiManager.deleteDownloads(
        downloadItems,
        function downloadsDeleted(downloadID) {
          _removeDownloadsFromUI([downloadElements[downloadID]], 1);
        },
        function onError(downloadID, msg) {
          console.warn('Could not delete ' + downloadID + ' : ' + msg);
          deletionDone();
        },
        function onComplete() {
          if (focusedNext) {
            handleChangeFocus(focusedNext);
          }
          deletionDone();
        }
      );
    }
    doDeleteDownloads();
  }

  function _optionsHandler() {
    var focusedElement = document.querySelector('#downloads .focus');
    var downloadID = focusedElement.id;
    var download = DownloadApiManager.getDownload(downloadID);
    DownloadUI.showActions(download);
  }

  // to select mutile download forme the option menue
  function enterMultDelMode() {
    _loadEditMode();
  }
  //do download action at the edid mode frome the softkey
  function _selectAllSoftKeyhandler() {
    _enableAllChecks();
    _onAllDownloadSelected();
  }

  function _deSelectAllSoftKeyhandler() {
    _disableAllChecks();
    _onAllDownloadSelected();
  }

  function _deleteSoftKeyhandler() {
    _deleteDownloads();
  }

  function _onAllDownloadSelected() {
    if (isEditMode) {
      var focusedElement = document.querySelector('#downloads .focus');
      var input = focusedElement.childNodes[0].childNodes[0];
      if (typeof input === 'undefined') {
        return;
      }
      var checked = input.checked;
      if (checked === false) {
        numberOfCheckedDownloads = 0;
      } else {
        numberOfCheckedDownloads = downloadsContainer.children.length;
      }
      navigator.mozL10n.setAttributes(selectnumber[0], 'downloads-selected', {
        n: numberOfCheckedDownloads
      });
      _updateButtonsStatus();
    }
  }

  function _checkEmptyList() {
    if (!downloadsContainer) {
      return;
    }
    var isEmpty = (downloadsContainer.children.length === 0);

    if (isEmpty) {
      downloadsContainer.hidden = true;
      emptyDownloadsContainer.classList.remove('hidden');
      isEditMode = false;
      SettingsSoftkey.init(noDownloadsSoftKeyBar);
      SettingsSoftkey.show();
    } else {
      downloadsContainer.hidden = false;
      emptyDownloadsContainer.classList.add('hidden');
    }
    //editButton.disabled = isEmpty;
  }

  function _newDownload(download) {
    _prepend(download);
    if (isEditMode) {
      numberOfDownloads++;
      _updateButtonsStatus();
    }
  }

  function _render(downloads, oncomplete) {
    if (!downloadsContainer) {
      return;
    }

    if (!downloads || downloads.length == 0) {
      _checkEmptyList();
      return;
    }
    // Clean before rendering
    downloadsContainer.innerHTML = '';
    // Render
    downloads.forEach(_append);
    oncomplete && oncomplete();
    _changeFocus();
  }

  function _changeFocus() {
    var event = new CustomEvent('panelready', {
      detail: {
        current: Settings.currentPanel
      }
    });
    window.dispatchEvent(event);
  }

  function changeProgressFocus() {
    let selectedItem =
      document.querySelector('#downloads gaia-progress[selected="true"]');
    let focusProgressItem =
      document.querySelector('#downloads .focus gaia-progress');
    if (selectedItem) {
      selectedItem.setAttribute('selected', false);
    }
    if (focusProgressItem) {
      focusProgressItem.setAttribute('selected', true);
    }
  }

  function handleKeyDown(event) {
    switch (event.key) {
      case 'Enter':
      case 'Accept':
        var focusedElement = document.querySelector('#downloads .focus');
        if (focusedElement) {
          if (isEditMode) {
             _onDownloadSelected(event);
           }
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        if (isEditMode === true) {
          _updateButtonsStatus();
        } else if (!document.getElementById('option-menu')) {
          _checkShowSoftKey();
        }

        changeProgressFocus();
        break;
      case 'BrowserBack':
      case 'Backspace':
        if (isMutilDelEditMode) {
          isMutilDelEditMode = false;
          _updateButtonsStatus();
        } else if (isEditMode) {
          _closeEditMode();
          _checkShowSoftKey();
          event.preventDefault();
        }
        break;
    }
  }

  function handleChangeFocus(focusNode) {
    var focused = downloadsPanel.querySelectorAll('.focus');
    if (focused.length > 0) {
      focused[0].classList.remove('focus');
    }

    focusNode.classList.add('focus');
    focusNode.focus();
    _checkShowSoftKey();
    setTimeout(() => {
      focusNode.scrollIntoView(false);
    }, 0);
  }

  function handleActivity() {
    if (!downloadsPanel.dataset.downloadFileName) {
      return;
    }

    var fileName = downloadsPanel.querySelectorAll('li .fileName');
    for (var i = 0; i < fileName.length; i++) {
      if (fileName[i].textContent === downloadsPanel.dataset.downloadFileName) {
        handleChangeFocus(fileName[i].parentNode.parentNode);
      }
    }
  }

  function handleListShow(event) {
    handleActivity();
    changeProgressFocus();

    if (event.detail.current == '#downloads') {
      if (downloadsContainer.children.length === 0) {
        SettingsSoftkey.init(noDownloadsSoftKeyBar);
        SettingsSoftkey.show();
      } else {
        DownloadItem.updateDownloadDate();
        _checkShowSoftKey();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
  }

  function _checkShowSoftKey(state) {
    DeviceFeature.ready(() => {
      _showSoftkey(state);
    });
  }

  function _showSoftkey(state) {
    var focusedElement = document.querySelector('#downloads .focus');
    if (focusedElement == null) {
      focusedElement = document.querySelector('#downloads .focus1');
    }

    if (focusedElement != null) {
      var downloadID = focusedElement.id;
      var download = DownloadApiManager.getDownload(downloadID);
      var fileName = DownloadFormatter.getFileName(download);
      var type = MimeMapper.guessTypeFromFileProperties(fileName, download.contentType);
      var downLoadState = focusedElement.getAttribute('data-state');
      var lowMemoryFlag =
        DeviceFeature.getValue('lowMemory') === 'true' ? true : false;

      if (state) {
        downLoadState = state;
      }
      if (downLoadState == 'succeeded') {
        if (type.startsWith('image/')) {
          SettingsSoftkey.init(succeeWallpaperSoftKeyBar);
        } else if (type.startsWith('audio/')) {
          SettingsSoftkey.init(lowMemoryFlag ? succeeMusicSoftKeyBarForLite :
            succeeMusicSoftKeyBar);
        } else {
          SettingsSoftkey.init(succeeNosupportSoftKeyBar);
        }
      } else if (downLoadState == 'downloading') {
        if (type.startsWith('image/')) {
          SettingsSoftkey.init(downloadingWallpaperSoftKeyBar);
        } else if (type.startsWith('audio/')) {
          SettingsSoftkey.init(lowMemoryFlag ?
            downloadingMusicSoftKeyBarForLite : downloadingMusicSoftKeyBar);
        } else {
          SettingsSoftkey.init(downloadingNosupportSoftKeyBar);
        }
      } else if (downLoadState === 'stopped') {
        if (type.startsWith('image/')) {
          SettingsSoftkey.init(stoppedWallpaperSoftKeyBar);
        } else if (type.startsWith('audio/')) {
          SettingsSoftkey.init(lowMemoryFlag ? stoppedMusicSoftKeyBarForLite :
            stoppedMusicSoftKeyBar);
        } else {
          SettingsSoftkey.init(stoppedNosupportSoftKeyBar);
        }
      } else if (downLoadState === 'failed') {
        if (type.startsWith('image/')) {
          SettingsSoftkey.init(failedWallpaperSoftKeyBar);
        } else if (type.startsWith('audio/')) {
          SettingsSoftkey.init(lowMemoryFlag ? failedMusicSoftKeyBarForLite :
            failedMusicSoftKeyBar);
        } else {
          SettingsSoftkey.init(failedNosupportSoftKeyBar);
        }
      }
    }
    SettingsSoftkey.show();
  }

  function handleListHide(event) {
    console.log('Settings.currentPanel=', Settings.currentPanel);
    SettingsSoftkey.hide();
    window.removeEventListener('keydown', handleKeyDown);
  }

  function _onerror() {
    // TODO Implement screen or error message
    console.error('Error while retrieving');
  }

  function _create(download) {
    var li = DownloadItem.create(download);
    if (download.state === 'downloading') {
      setTimeout(() => {
        _changeFocus();
      }, 500);
      download.onstatechange = _onDownloadStateChange;
    }
    //li.addEventListener('click', _onDownloadAction);

    return li;
  }

  function _prepend(download) {
    if (downloadsContainer.children.length === 0) {
      _append(download);
      _checkEmptyList();
      return;
    }

    downloadsContainer.insertBefore(
      _create(download),
      downloadsContainer.firstChild
    );
    _checkEmptyList();
  }

  function _append(download) {
    downloadsContainer.appendChild(_create(download));
    download.onstatechange = _onDownloadStateChange;
  }

  function _getElementForId(id) {
    return downloadsContainer.querySelector('[data-id="' + id + '"]');
  }

  function _update(download, click) {
    var id = DownloadItem.getDownloadId(download);
    var elementToUpdate = _getElementForId(id);
    if (!elementToUpdate) {
      console.error('Item to update not found');
      return;
    }
    DownloadItem.refresh(elementToUpdate, download, click);
    DownloadApiManager.updateDownload(download);
    //_changeFocus();
  }

  function _delete(id) {
    var elementToDelete = _getElementForId(id);
    if (!elementToDelete) {
      console.error('Item to delete not found');
      return;
    }
    downloadsContainer.removeChild(elementToDelete);
    _checkEmptyList();
  }

  function _onDownloadAction(event) {
    if (isEditMode) {
      return;
    }
    var downloadID = event.target.id || event.target.dataset.id;
    var download = DownloadApiManager.getDownload(downloadID);
    _actionHandler(download);
  }

  function _onDownloadStateChange(event) {
    var download = event.download;
    // We don't care about finalized as a state change. The DownloadList and
    // DownloadItem are not designed to consume this state change.
    if (download.state === 'finalized') {
      return;
    }
    var downloadId = DownloadItem.getDownloadId(download);
    if (resumeClick[downloadId] === true && download.state === 'downloading') {
      resumeClick[downloadId] = false;
      _checkShowSoftKey(download.state);
      setTimeout(() => {
        _showResumeToaster();
      }, 500);
    }

    if (download.state === 'succeeded' || download.state === 'stopped') {
      var downloadConfirmDialog = document.getElementById('download-confirm-dialog');
      setTimeout(() => {
        if (download.state === 'succeeded' && downloadConfirmDialog.hidden == false) {
          var header = document.getElementById('downloads-header');
          var head1 = header.firstElementChild;
          head1.setAttribute('data-l10n-id', 'downloads');
          downloadConfirmDialog.hidden = true;
          downloadsContainer.hidden = false;
        }
        _checkShowSoftKey();
      }, 500);
    }
    _update(download);
  }

  function _actionHandler(download, actionString) {
    if (!download) {
      console.error('Download not retrieved properly');
      return;
    }

    switch (download.state) {
      case 'downloading':
        // downloading -> paused
        _pauseDownload(download);
        break;
      case 'stopped':
        if (actionString === 'stop') {
          _pauseDownload(download);
        } else {
          _restartDownload(download);
        }
        break;
      case 'finalized':
      case 'succeeded':
        // launch an app to view the download
        //_showDownloadActions(download);
        break;
    }
  }

  function _pauseDownload(download) {
    var request = DownloadUI.show(DownloadUI.TYPE.STOP, download);

    request.onconfirm = function() {
      if (download.pause) {
        download.pause().then(function() {
          // We don't remove the listener because the download could be
          // restarted in notification tray
          _update(download, true);
          _checkShowSoftKey();
          _showstoppedToaster();
        }, function() {
          console.error('Could not pause the download');
        });
      }
    };
  }

  function _showResumeToaster() {
    showToast('downloading-resumed');
  }

  function _showstoppedToaster() {
    showToast('downloading-stopped');
  }

  function _restartDownload(download) {
    // DownloadUI knows which will be the correct confirm depending on state
    // and error attributes
    var request = DownloadUI.show(DownloadUI.TYPE.STOPPED, download);
    resumeClick[DownloadItem.getDownloadId(download)] = true;
    request.onconfirm = function() {
      if (download.resume) {
        download.resume().then(function() {
          // Nothing to do here -> this resolves only once the download has
          // succeeded.
          //_showResumeToaster();
        }, function onError() {
          // This error is fired when a download restarted is paused
          console.error(navigator.mozL10n.get('restart_download_error'));
        });
      }
    };
  };

  function _showDownloadActions(download) {

    var actionReq = DownloadUI.showActions(download);

    actionReq.onconfirm = function(evt) {
      var req = DownloadHelper[actionReq.result.name](download);

      req.onerror = function() {
        DownloadHelper.handlerError(req.error, download, function removed(d) {
          if (!d) {
            return;
          }
          // If error when opening, we need to delete it!
          var downloadId = DownloadItem.getDownloadId(d);
          var elementToDelete = _getElementForId(downloadId);
          DownloadApiManager.deleteDownloads(
            [{
              id: downloadId,
              force: true // deleting download without confirmation
            }],
            function onDeleted() {
              _removeDownloadsFromUI([elementToDelete], 1);
              _checkEmptyList();
            },
            function onError() {
              console.warn('Download not removed during launching');
            }
          );
        });
      };
    };
  }

  // Methods for controlling the edit mode

  function _getAllChecks() {
    return downloadsContainer.querySelectorAll('input');
  }

  function _getAllChecked() {
    return downloadsContainer.querySelectorAll('input:checked');
  }

  function _markAllChecksAs(condition) {
    var checks = _getAllChecks();
    for (var i = 0; i < checks.length; i++) {
      checks[i].checked = condition;
    }
    numberOfCheckedDownloads = condition ? numberOfDownloads : 0;
  }

  function _enableAllChecks() {
    _markAllChecksAs(true);
    _updateButtonsStatus();
  }

  function _disableAllChecks() {
    _markAllChecksAs(false);
    _updateButtonsStatus();
  }

  function _updateButtonsStatus() {
    if (numberOfDownloads === 0) {
      // Cache number of downloads
      numberOfDownloads = _getAllChecks().length;
    }

    var focusItem = downloadsContainer.querySelector('.focus input:checked');
    var focusChecked = focusItem ? focusItem.checked : false;

    // Delete button status
    //deleteButton.disabled = !(numberOfCheckedDownloads > 0);
    if (numberOfCheckedDownloads == 0) {
      SettingsSoftkey.init(editSoftKeyBar1);
      SettingsSoftkey.show();
    } else if (numberOfCheckedDownloads > 0 && numberOfCheckedDownloads < numberOfDownloads) {
      SettingsSoftkey.init(focusChecked ? editSoftKeyBar4 : editSoftKeyBar2);
      SettingsSoftkey.show();
    } else if (numberOfCheckedDownloads === numberOfDownloads) {
      SettingsSoftkey.init(editSoftKeyBar5);
    }

    // 'Select all' button status
    //selectAllButton.disabled = (numberOfCheckedDownloads === numberOfDownloads);
    // Nothing checked?
    //deselectAllButton.disabled = (numberOfCheckedDownloads === 0);
  }

  function _toAdjustLSoftBigger() {
    var softL = document.getElementById('software-keys-left');
    softL.classList.remove('sk-button');
    softL.classList.add('sk-download-button');
  }

  function _toRemoveAdjustLSoftBigger() {
    var softL = document.getElementById('software-keys-left');
    softL.classList.remove('sk-download-button');
    softL.classList.add('sk-button');
  }

  function _onDownloadSelected(event) {
    if (isEditMode && (event.target.tagName === 'LI' || event.target.tagName === 'INPUT' || event.target.tagName === 'BODY')) {
      var focusedElement = document.querySelector('#downloads .focus');
      var input = focusedElement.childNodes[0].childNodes[0];
      if (typeof input === 'undefined') {
        return;
      }
      if (event.target.tagName === 'BODY') {
        if (input.checked) {
          input.checked = false;
        } else {
          input.checked = true;
        }
      }
      var checked = input.checked;
      checked ? numberOfCheckedDownloads++ : numberOfCheckedDownloads--;
      navigator.mozL10n.setAttributes(selectnumber[0], 'downloads-selected', {
        n: numberOfCheckedDownloads
      });
      _updateButtonsStatus();
    }
  }

  function _deleteDownloads() {
    var downloadsChecked = _getAllChecked() || [];
    var downloadItems = [],
      downloadElements = {};
    var downloadList = [];
    var total = downloadsChecked.length;
    var multipleDelete = total > 1;
    //SettingsSoftkey.hide();
    for (var i = 0; i < total; i++) {
      downloadItems.push({
        id: downloadsChecked[i].value,
        force: multipleDelete
      });
      downloadElements[downloadsChecked[i].value] =
        downloadsChecked[i].parentNode.parentNode;
      if (multipleDelete) {
        downloadList.push(downloadElements[downloadsChecked[i].value]);
      }
    }

    function deletionDone() {
      _checkEmptyList();
      //_closeEditMode();
      //_changeFocus();
    }

    function doDeleteDownloads() {
      DownloadApiManager.deleteDownloads(
        downloadItems,
        function downloadsDeleted(downloadID) {
          _removeDownloadsFromUI([downloadElements[downloadID]], total);
          downloadsPanel.classList.remove('edit');
          isEditMode = false;
        },
        function onError(downloadID, msg) {
          isMutilDelEditMode = false;
          console.warn('Could not delete ' + downloadID + ' : ' + msg);
          _updateButtonsStatus();
          deletionDone();
        },
        function onComplete() {
          isMutilDelEditMode = false;
          deletionDone();
        }
      );
    }

    isMutilDelEditMode = true;
    if (multipleDelete) {
      var req = DownloadUI.show(DownloadUI.TYPE.DELETE_ALL, downloadList);
      req.onconfirm = () => {
        doDeleteDownloads();
        downloadsPanel.classList.remove('edit');
        isEditMode = false;
      }
      req.oncancel = () => {
        isMutilDelEditMode = false;
        _updateButtonsStatus();
        deletionDone();
      };
    } else {
      doDeleteDownloads();
    }
  }

  function _removeDownloadsFromUI(elements, total) {
    for (var i = 0; i < elements.length; i++) {
      downloadsContainer.removeChild(elements[i]);
    }
    _changeFocus();
    numberOfCheckedDownloads = 0;
    deleteCount++;
    if (deleteCount === total) {
      deleteCount = 0;
      _showDeleteToaster(elements, total);
    }
  }

  function _showDeleteToaster(elements, total) {
    var isEmpty = (downloadsContainer.children.length === 0);
    var option = {
      messageL10nId: null,
      messageL10nArgs: null,
      message: null,
      latency: 3000,
      useTransition: true
    };
    SettingsSoftkey.hide();
    if (total > 1) {
      option.messageL10nId = 'downloads-deleted';
      option.messageL10nArgs = {n: total};
    } else {
      let fileName = elements[0].childNodes[1].children[2].dataset.fileName;
      option.messageL10nId = 'downloads-file-deleted';
      option.messageL10nArgs = {filename: fileName};
    }
    showToast(option.messageL10nId, option.messageL10nArgs);
    setTimeout(() => {
      if (isEmpty === false)
        SettingsSoftkey.show();
    }, 3000);
  }

  function _loadEditMode() {
    // Disable all checks
    _disableAllChecks();

    // Add 'edit' stype
    downloadsPanel.classList.add('edit');
    //downloadsEditMenu.hidden = false;

    // Change edit mdoe status
    isEditMode = true;
    _updateButtonsStatus();

    navigator.mozL10n.setAttributes(selectnumber[0], 'downloads-selected', {
      n: numberOfCheckedDownloads
    });
  }

  function _closeEditMode() {
    // Remove 'edit' styles
    downloadsPanel.classList.remove('edit');

    //downloadsEditMenu.hidden = true;

    // Clean vars
    isEditMode = false;
    numberOfDownloads = 0;
    numberOfCheckedDownloads = 0;
    _checkShowSoftKey();
  }

  function _downloadApiManagerListener(changeEvent) {
    switch (changeEvent.type) {
      case 'added':
        // First we'll try and find an existing item with the download api id.
        var element = null;
        if (changeEvent.downloadApiId &&
          (element = _getElementForId(changeEvent.downloadApiId))) {
          // If we find one, we'll want to update it's id before updating the
          // content.
          DownloadItem.updateDownloadId(changeEvent.download, element);
        } else if ((element = _getElementForId(changeEvent.download.id))) {
          // Secondly, try and find it by it's download id.
          _update(changeEvent.download);
        } else {
          // Lastly, if we didn't find it by downloadApiId or id, it's truly
          // new to the user so we need to add it to the download list.
          _newDownload(changeEvent.download);
          resumeClick[DownloadItem.getDownloadId(changeEvent.download)] = false;
          //_changeFocus();
        }
        break;
    }
  }

  var DownloadsList = {
    init: function(oncomplete) {
      var scripts = [
        'shared/js/download/download_store.js', // Must be loaded first.
        'shared/js/mime_mapper.js',
        'shared/js/download/download_formatter.js',
        'js/downloads/download_api_manager.js',
        'js/downloads/download_item.js',
        'js/downloads/downloads_ui.js',
        'js/downloads/download_helper.js',
        'shared/js/l10n_date.js'
      ];

      if (!navigator.mozDownloadManager) {
        scripts.push('js/downloads/desktop/desktop_moz_downloads.js');
      }

      LazyLoader.load(scripts, function onload() {
        // Cache DOM Elements
        // Panels
        downloadsContainer = document.querySelector('#downloadList ul');
        emptyDownloadsContainer =
          document.getElementById('download-list-empty');
        var emptyChild = emptyDownloadsContainer.firstElementChild;
        emptyChild.setAttribute('data-l10n-id', 'no-downloads');

        downloadsPanel = document.getElementById('downloads');
        selectnumber = document.getElementsByClassName('selectnumber');
        // Menus
        //downloadsEditMenu = document.getElementById('downloads-edit-menu');
        // Buttons
        //editButton = document.getElementById('downloads-edit-button');
        //editHeader = document.getElementById('downloads-edit-header');
        //deleteButton = document.getElementById('downloads-delete-button');
        //selectAllButton =
        //document.getElementById('downloads-edit-select-all');
        //deselectAllButton =
        //document.getElementById('downloads-edit-deselect-all');

        // Localization of the nodes for avoiding weird repaintings
        var noDownloadsTextEl = document.getElementById('dle-text');
        var editModeTitle = document.getElementById('downloads-title-edit');

        // Initialize the Api Manager and set our listener.
        DownloadApiManager.init();
        DownloadApiManager.setListener(_downloadApiManagerListener.bind(this));

        // Render the entire list
        DownloadApiManager.getDownloads(
          _render.bind(this),
          _onerror.bind(this),
          oncomplete
        );

        // Update method added
        DownloadApiManager.setOnDownloadHandler(_newDownload);

        // Add listener to edit mode
        //editButton.addEventListener('click', _loadEditMode.bind(this));
        //editHeader.addEventListener('action', _closeEditMode.bind(this));
        //selectAllButton.addEventListener('click', _enableAllChecks.bind(this));
        //deselectAllButton.addEventListener('click',
        // _disableAllChecks.bind(this));
        //deleteButton.addEventListener('click', _deleteDownloads.bind(this));
        //downloadsContainer.addEventListener('click',
        //_onDownloadSelected.bind(this));
        //add for the ok key
        window.addEventListener('show-download-list', handleListShow);
        window.addEventListener('hide-download-list', handleListHide);
        window.addEventListener('menuEvent', function(e) {
          if (e.detail.menuVisible == true) {
            optionsShow = true;
          } else {
            optionsShow = false;
          }
        });
        window.addEventListener('confirm-dialog-hide', function(e) {
          _checkShowSoftKey();
        });
      });
    },
  };
  exports.DownloadsList = DownloadsList;

}(this));

// startup
navigator.mozL10n.once(DownloadsList.init.bind(DownloadsList));
