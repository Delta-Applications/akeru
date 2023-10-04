'use strict';

(function(exports) {
  //view and container map
  const VIEW_MAP = {
    'layout-list': 'thumbnail-views',
    'layout-selection': 'thumbnail-views',
    'layout-fullscreen-player': 'player-view',
  };

  //option menu is not a panel, but still keep it's elements
  const OPTION_MENU = 'option-menu';

  const CHANGE_MODE = {
    none: 'none',
    added: 'added',
    removed: 'removed',
  };

  var controls = {};
  var curPanel = null;
  var isPreventKeyProcess = false;
  var isAlreadyFullscreen = false;
  var listDomNode = null;

  var nav_id = 0;

  /*store the focused element when option menu is opened,
    and restore it after option menu is closed,
    it should be set null if a new navigable list is created
    in one item of option menu to prevent restore*/
  var _storeFocused = null;
  var intervalId = null;
  var fastplayflag = 0;

  /*to fix bug 522:
    as list and selection views share the same control,
    use _storeIndex to store the index of list view when enter selection view,
    and restore when back to list view
  */
  var _storeIndex = -1;

  /*softkey bar & option menu*/
  var optTakeVideo = {
    name: 'Take Video',
    l10nId: 'opt-takevideo',
    priority: 1,
    method: function() {
      launchCameraApp();
    }
  };

  var optSelect = {
    name: 'Select',
    l10nId: 'select',
    priority: 2
  };

  var optDeselect = {
    name: 'Deselect',
    l10nId: 'opt-deselect',
    priority: 2
  };

  var optPickSelect = {
    name: 'Ok',
    l10nId: 'confirm-ok',
    priority: 2,
    method: function() {
      window.close();
    }
  };

  var optDelete = {
    name: 'Delete',
    l10nId: 'opt-delete',
    priority: 5,
    method: function() {
      isDisplayToast = true;
      if (curPanel === LAYOUT_MODE.selection) {
        deleteSelectedItems(deleteFilesDone);
      }
      else {
        deleteCurrentVideo();
      }
    }
  };

  var optShare = {
    name: 'Share',
    l10nId: 'share',
    priority: 5,
    method: function() {
      NavigationMap.disableNav = true;
      if(curPanel === LAYOUT_MODE.selection) {
        shareSelectedItems();
      } else {
        shareCurrentVideo();
      }
    }
  };

  var optMultiSelect = {
    name: 'Select Multiple',
    l10nId: 'opt-selectmultiple',
    priority: 5,
    method: function() {
      showSelectView();
    }
  };

  var optFileInfo = {
    name: 'File Info',
    l10nId: 'opt-fileinfo',
    priority: 5,
    method: function() {
      window.performance.mark('check-video-detail-start');
      showInfoView();
    }
  };

  var optFileInfoBack = {
    name: 'Cancel',
    l10nId: 'cancel',
    priority: 1,
    method: function() {
      hideInfoView(true);
      if(currentLayoutMode === LAYOUT_MODE.fullscreenPlayer) {
        NavigationMap.updateSoftKey(true);
      } else if(currentLayoutMode === LAYOUT_MODE.list) {
        NavigationMap.setSoftKeyBar(LAYOUT_MODE.list);
      }
    }
  };

  var optSelectAll = {
    name: 'Select All',
    l10nId: 'opt-selectall',
    priority: 1,
    method: function() {
      selectAll(true);
    }
  };

  var optDeselectAll = {
    name: 'Deselect All',
    l10nId: 'opt-deselectall',
    priority: 1,
    method: function() {
      selectAll(false);
    }
  };

  var optFullScreen = {
    name: 'Full Screen',
    l10nId: 'opt-fullscreen',
    priority: 1,
    method: function() {
      NavigationMap.reqFullscreen();
    }
  };

  var optPickCancel = {
    name: 'Cancel',
    l10nId: 'cancel',
    priority: 1,
    method: function() {
      NavigationMap.navViewBack();
    }
  };

  var optPickDone = {
    name: 'Done',
    l10nId: 'done',
    priority: 1,
    method: function() {
      postPickResult();
    }
  };

  var optPlay = {
    icon: 'play',
    l10nId: '',
    name: 'Play',
    priority: 2,
    method: function() {
      handlePlayButtonClick();
    }
  };

  var optVolume = {
    l10nId: 'opt-volume',
    name: 'Volume',
    priority: 5,
    method: function () {
      navigator.volumeManager.requestShow();
    }
  };

  var optRotate = {
    l10nId: 'opt-rotate',
    name: 'Rotate',
    priority: 5,
    method: function () {
      if (screen.orientation.type === 'portrait-primary') {
        screen.orientation.lock("landscape-primary");
      } else {
        screen.orientation.lock("portrait-primary");
      }
    }
  };

  var optDonglePick = {
    l10nId: 'opt-play',
    name: 'Play',
    priority: 3,
    method: function () {

      let orderedSelectedFileNames = Object.keys(thumbnailList.thumbnailMap)
        .filter((key) => {
          return selectedFileNames.includes(key);
        });
      selectedFileNames = orderedSelectedFileNames;

      let arr = [];
      for (let i = 0; i < selectedFileNames.length; i++) {
        let file = selectedFileNames[i];
        arr.push({
          path: file,
          title: file.substring(file.lastIndexOf('/') + 1).match(/^.+(?=\.\w+$)/)[0]
        });
      }
      pendingPick.postResult(arr);
    }
  };

  var actMainList = [optTakeVideo, optSelect, optShare, optFileInfo, optDelete, optMultiSelect];
  var actPlayer = [optFullScreen, optPlay, optVolume, optRotate, optShare, optFileInfo, optDelete];
  var actPlayerPaused = [optFullScreen, optPlay, optVolume, optRotate, optShare, optFileInfo, optDelete];
  var actPlayerPick = [optPickCancel, optPlay, optPickDone];

  /*@select=true --> select all; false --> unselect all*/
  function selectAll(select) {
    var control = getCurControl();
    if ( control ) {
      selectedFileNames = [];
      selectedFileNamesToBlobs = {};

      /*add class 'selected' to element*/
      const controlElementsLength = control.elements.length
      for ( var i = 0; i < controlElementsLength; i++ ) {
        setSelected(control.elements[i], select);
      }

      if ( select == true ) {
        selectedFileNames = Object.keys(thumbnailList.thumbnailMap);
        selectedFileNames.forEach(function (filename) {
          videodb.getFile(filename, function(blob) {
            selectedFileNamesToBlobs[filename] = blob;
          });
        });
      }

      NavigationMap.setSoftKeyBar(curPanel);
      updateSelectedNumber(selectedFileNames.length);
    }
  };

  function navUpdate(elements) {
    var i=0;
    var id = nav_id;  /*to avoid 'data-nav-id' reproduced with grid*/

    for(i=0; i < elements.length; i++) {
        elements[i].setAttribute('data-nav-id', id);
        elements[i].style.setProperty('--nav-left', -1); //-1: invalid ID
        elements[i].style.setProperty('--nav-right', -1);
        elements[i].style.setProperty('--nav-down', id+1);
        elements[i].style.setProperty('--nav-up', id-1);
        elements[i].setAttribute('tabindex', 0);
        id++;
    }

    //top element
    elements[0].style.setProperty('--nav-up', id-1);
    //bottom element
    elements[elements.length-1].style.setProperty('--nav-down', nav_id);
    nav_id = id;
  };

  function getCurContainerId() {
    var id = null;

    id = VIEW_MAP[curPanel];
    return id;
  };

  function getCurControl() {
    var control = null;
    var containerId = getCurContainerId();

    if ( containerId ) {
      control = controls[containerId];
    }
    return control;
  };

  function getCurItem() {
    var item = null;
    var curControl = getCurControl();

    if ( curControl ) {
      if ( curControl.index >= 0 &&
        curControl.index < curControl.elements.length ) {
        item = curControl.elements[curControl.index];
      }
    }
    return item;
  };

  function sendIndexEvent(panel, index, item) {
    var evt = new CustomEvent("index-changed", {
      detail: {
        panel: panel,
        index: index,
        focusedItem: item
      },
      bubbles: true,
      cancelable: false
    });

    window.dispatchEvent(evt);
  };

  function setCurIndex(index) {
    var curControl = getCurControl();
    const len = curControl.elements.length;
    if ( curControl ) {
      if ( index >= -1 && index < len ){
        curControl.index = index;
        /*broadcoast change event*/
        sendIndexEvent(curPanel, index,
          (index == -1) ? null : curControl.elements[index]);
      }
    }
  };

  function observeChange(id) {
    var config = {
      childList: true,
      subtree: true,
      attributes: true,
    };

    var observer = new MutationObserver(function (mutations) {
      var changed = CHANGE_MODE.none;
      var nodes = [];

      mutations.forEach(function (mutation) {
        if (changed == true) {
          return;
        }

        if (mutation.type == 'childList') {
          if (mutation.addedNodes.length > 0) {
            nodes = Array.prototype.slice.call(mutation.addedNodes);
            nodes.forEach(function (node) {
              if (node.classList && node.nodeName == 'LI') {
                changed = CHANGE_MODE.added;
                return;
              }
            });
          }
          else if (mutation.removedNodes.length > 0) {
            nodes = Array.prototype.slice.call(mutation.removedNodes);
            nodes.forEach(function (node) {
              if (node.classList && node.nodeName == 'LI') {
                changed = CHANGE_MODE.removed;
                return;
              }
            });
          }
        }
      });

      if (changed != CHANGE_MODE.none) {
        var query = controls[id] ? controls[id].query : null;
        NavigationMap.navSetup(id, query); //reset navigation

        if ( changed == CHANGE_MODE.added ) {
          onNodesAdded(id);
        }
        else if (changed == CHANGE_MODE.removed) {
          onNodesRemoved(id);
        }
      }
    });

    observer.observe(document.getElementById(id), config);
  };

  function onNodesAdded(containerId) {
    var control = controls[containerId];
    if(control && control.elements.length > 0) {
      if (exports.option.menuVisible == false) {
        NavigationMap.setFocus((control.index == -1) ? 0 : control.index);
      }
    }
  };

  function onNodesRemoved(containerId) {
    var control = controls[containerId];

    if ( !control ) {
      return;
    }

    var container = document.getElementById(containerId);
    var focused = container ? container.querySelector(".focus") : null;
    var index = 0;

    /*the focused item was not removed, just update index*/
    if ( focused ) {
      var elements = Array.prototype.slice.call(control.elements);
      index = elements.indexOf(focused);
      if ( control.index == -1 ) {
        console.log("onNodesRemoved error: focused item was not removed, but can't be found");
      }
      else {
        /*focus was not changed,
        but still call setCurIndex to generate 'index-changed' event */
        setCurIndex(index);
      }
    }
    /*focused item was removed,
    or the background list(not current panel) was changed*/
    else {
      if ( control.index >= 0 &&
        control.index < control.elements.length ) {
        /*reset the focus at the item with same index*/
        index = control.index;
      }
      else if (control.index >= control.elements.length) {
        /*the removed item was last none, keep focus on last one*/
        index = control.elements.length-1;
      }

      if ( getCurContainerId() == containerId ) {
        /*update focus for current panel*/
        NavigationMap.setFocus(index);
      }
      else {
        /*for the background changed list, only update index*/
        control.index = index;
      }
    }
  };

  function normalHandleKeydown(e) {
    if (isPreventKeyProcess) {
      return;
    }
    var infoView = document.getElementById('info-view');
    var infoSection = document.getElementById('infosection');
    switch (e.key) {
      case 'HeadsetHook':
        if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
          if (!playing) {
            play();
          } else {
            pause();
          }
        }
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
          var direction = (e.key === 'ArrowRight') ? 1 : -1;
          var offset = direction * 10;
          if (!intervalId) {
            intervalId = window.setInterval(function() {
              seekVideo(dom.player.currentTime + offset);
              NavigationMap.updateSkipicon(direction);
              NavigationMap.updateDisplay(true);
              fastplayflag = 1;
            }, 500);
          }
        }
        break;
     case 'ArrowDown':
       if (exports.option.menuVisible) {
         return;
       }
       if (!infoView.classList.contains('hidden')) {
         infoSection.scrollTop += 60;
       } else if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
         if (navigator.volumeManager) {
           navigator.volumeManager.requestDown();
         }
       }
       break;
     case 'ArrowUp':
       if (exports.option.menuVisible) {
         return;
       }
       if (!infoView.classList.contains('hidden')) {
         infoSection.scrollTop -= 60;
       } else if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
         if (navigator.volumeManager) {
           navigator.volumeManager.requestUp();
         }
       }
       break;
      case 'Backspace':
      case 'BrowserBack':
        if (isDonglePickMultiple){
          isDonglePickMultiple = false;
          return;
        }

        if (!exports.option.menuVisible) {
          if (VideoUtils.isShowDialog) { //confirm dialog is shown, close it
            e.preventDefault();
            CustomDialog.hide();
            if(curPanel === LAYOUT_MODE.fullscreenPlayer) {
              setButtonPaused(true);
            }
            window.option.show();
            VideoUtils.isShowDialog = false;
          } else {
            if (SUB_MODE.infoView !== curPanel) {
              screen.mozLockOrientation("default");
            }
            NavigationMap.navViewBack(e);
          }
        }
        break;
    }
  }

  function normalHandleKeyup(e) {
    if (isPreventKeyProcess) {
      isPreventKeyProcess = false;
      return;
    }
    let control = controls[VIEW_MAP['layout-list']];
    switch (e.key) {
      case 'ArrowLeft':
        if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
          if (fastplayflag === 0 && !exports.option.menuVisible && !pendingPick) {
            isFullScreen = false;
            if (canPlay) {
              canPlay = false;
              previous();
            }
          }
        }
        break;
      case 'ArrowRight':
        if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
          if (fastplayflag === 0 && !exports.option.menuVisible && !pendingPick) {
            isFullScreen = false;
            if (canPlay) {
              canPlay = false;
              next();
            }
          }
        }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        if (curPanel === LAYOUT_MODE.selection && !_storeFocused) {
          NavigationMap.setSoftKeyBar(LAYOUT_MODE.selection);
        }
        break;
    }

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && intervalId) {
      clearFastplay();
    }
  }

  function clearFastplay() {
    window.clearInterval(intervalId);
    intervalId = null;
    fastplayflag = 0;
    NavigationMap.updateDisplay(false);
  };

  function fullScreenHandleClick(e) {
    switch(e.key) {
      case 'HeadsetHook':
        if (curPanel === LAYOUT_MODE.fullscreenPlayer) {
          if (!playing) {
            play();
          } else {
            pause();
          }
        }
        break;
      case 'Enter':
        if (isFullScreen && playing) {
          pause();
        } else if (isFullScreen && !playing) {
          play();
        }
        e.preventDefault();
        e.stopPropagation();
        break;
      case 'SoftLeft':
      case 'SoftRight':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Backspace':
      case 'BrowserBack':
        if (isFullScreen) {
          isPreventKeyProcess = true;
          NavigationMap.updateFullScreenSet(false);
          e.preventDefault();
          e.stopPropagation();
        }
        break;
    }
  }

  var NavigationMap = {
    currentActivatedLength: 0,
    getCurControl: () => { return controls[VIEW_MAP['layout-list']] },
    init: function _init() {
      this.playerskipfoward = document.getElementById('player-skip-foward');
      this.durationtext = document.getElementById('duration-text');
      //TODO: debug
      window.addEventListener('visual-loaded', function(e) {
        const thmbSelect = document.querySelector("#thumbnails.select");
        const index = e.detail ? e.detail.index : 'first';
        var panelMode = thmbSelect !== null ? LAYOUT_MODE.selection : LAYOUT_MODE.list;
        NavigationMap.navSetup(VIEW_MAP[currentLayoutMode], '.focusable');
        NavigationMap.setFocus(index);
        NavigationMap.onPanelChanged(null, panelMode);
      });
      currentLayoutMode && observeChange(VIEW_MAP[currentLayoutMode]);

      document.addEventListener('focusChanged', function(e) {
        var focusedItem = e.detail.focusedElement;
        var curControl = getCurControl();
        if ( curControl && curControl.elements ) {
          /*convert to an array*/
          var elements = Array.prototype.slice.call(curControl.elements);
          /*find the index of focused item in current control*/
          var index = elements.indexOf(focusedItem);
          if ( index >= 0 ) {
            /*update index*/
            setCurIndex(index);
          }
        }
      });

      document.addEventListener('blur', () => {
        if (intervalId) {
          clearFastplay();
        }
      });

      window.addEventListener('fullscreenchange', () => {
        if (!isAlreadyFullscreen) {
          setControlsVisibility(false);
          window.addEventListener('keydown', fullScreenHandleClick);
        } else {
          VideoUtils.fitContainer(dom.videoContainer, dom.player, currentVideo.metadata.rotation || 0);
          window.addEventListener('keydown', normalHandleKeydown);
        }
        isAlreadyFullscreen = !isAlreadyFullscreen;
      });

      window.addEventListener('keydown', normalHandleKeydown);

      window.addEventListener('keyup', normalHandleKeyup, true);

      window.addEventListener('menuEvent', function(e) {
        if ( e.detail.menuVisible ) {
          e.detail.softkeyPanel.menu.form.id = OPTION_MENU;  //assign id to option menu for navSetup
          _storeFocused = document.querySelector(".focus");

          NavigationMap.optionReset();

          if((curPanel === LAYOUT_MODE.fullscreenPlayer && !isFullScreen)) {
            pause(true); //video will be paused when options menu is opened
          }
        }
        else {
          if ( _storeFocused ) {
            _storeFocused.classList.add('focus');
            _storeFocused.focus();
            _storeFocused = null;
          }

          if ( curPanel === LAYOUT_MODE.fullscreenPlayer ) {
            //update button
            setButtonPaused(true);
          }
        }
      });

      document.body.classList.toggle('large-text', navigator.largeTextEnabled);
      window.addEventListener('largetextenabledchanged', () => {
        document.body.classList.toggle('large-text', navigator.largeTextEnabled);
      });

      navigator.hasFeature('device.capability.volume-key').then((hasVolumeKey) => {
        if (hasVolumeKey) {
          actPlayer = [optFullScreen, optPlay, optShare, optFileInfo, optDelete];
          actPlayerPaused = [optFullScreen, optPlay, optShare, optFileInfo, optDelete];
        }
      });
    },
    reqFullscreen: () => {
      if (dom.player.seeking) {
        return;
      }
      NavigationMap.updateFullScreenSet(true);
      VideoUtils.fitContainer(dom.videoContainer, dom.player,
        currentVideo.metadata.rotation || 0);
      setTimeout(function () {
        window.removeEventListener('keydown', normalHandleKeydown);
        let players;
        if (!document.fullscreenElement && currentVideo.metadata.rotation === 0
          && currentVideo.metadata.width > currentVideo.metadata.height) {
          if (screen.orientation.type === 'landscape-primary') {
            players = document.getElementById('video-container');
          } else {
            players = document.getElementById('player');
          }
          dom.player.style.backgroundImage = 'none';
        } else {
          players = document.getElementById('video-container');
        }
        players.requestFullscreen();
      }, 300);
    },
    /*set focus for current panel*/
    setFocus: function _setFocus(id) {
      if ((exports.option) && (exports.option.menuVisible == true)) {
        return;
      }

      var curControl = getCurControl();
      if (!curControl) {
        return;
      }

      id = id || 0;
      id = (id == 'first') ? 0 :
          ((id == 'last') ? curControl.elements.length-1 : id);

      if (id >=0 && id < curControl.elements.length) {
        /*remove current focus, only one element has focus */
        var focused = document.querySelectorAll(".focus");
        for (var i=0; i < focused.length; i++) {
          focused[i].classList.remove('focus');
        }

        var toFocused = curControl.elements[id];
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        toFocused.focus();
      }

      //id may be -1
      setCurIndex(id);
    },

    /*setup navigation for the items that query from a container.
    @paramters:
        containerId: the id of the container element, undefined: coantainer = body
        query: the condition to query the items
    */
    navSetup: function _setup(containerId, query) {
      var elements = null;

      var container = (containerId == undefined) ? document.body :
                   document.getElementById(containerId);

      if ( container ) {
        elements = container.querySelectorAll(query);
        if (elements.length > 0){
          navUpdate(elements);
        }
      }

      if ( containerId && elements ) {
        if ( !controls[containerId] ) {
          controls[containerId] = {};
          controls[containerId].index = (elements.length > 0) ? 0 : -1;
        }
        controls[containerId].elements = elements;
        controls[containerId].query = query;  //store it for update when list changed
      }
    },

    /*option menu*/
    optionReset: function _reset() {
      this.navSetup(OPTION_MENU, '.menu-button');

      /*remove current focus, only one element has focus */
      var focused = document.querySelectorAll(".focus");
      for (var i=0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }

      var toFocused = controls[OPTION_MENU].elements[0];
      if ( toFocused ) {
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        toFocused.focus();
      }
    },

    /*get the focused item (element)*/
    getCurrentItem: function _currentItem() {
      return getCurItem();
    },

    /*return current control(the focusable elements of current shown panel)*/
    getCurrentControl: function _currentControl() {
      return getCurControl();
    },

    updateSoftKey: function _updateKey(paused) {
      var params = {
        header: { l10nId:'options-header' },
        items: []
      };
      optPlay.icon = paused ? 'play' : 'pause';
      optPlay.name = paused ? 'Play' : 'Pause';

      if ( pendingPick ) {
        params.items = actPlayerPick;
      }
      else if (paused) {
        params.items = actPlayerPaused;
      } else {
        params.items = actPlayer;
      }

      if(exports.option) {
        exports.option.initSoftKeyPanel(params);
      } else {
        exports.option = new SoftkeyPanel(params);
        exports.option.show();
      }
    },

    setSoftKeyBar: function _setSoftKeyBar(panel) {
      var control = null;
      var count = 0;
      var skbParams = {
        header: {l10nId: 'options-header'},
        items: []
      };

      if (isDonglePickMultiple) {
        panel = SUB_MODE.dongleActivity;
      }
      switch (panel) {
        case LAYOUT_MODE.list:
          if (thumbnailList.count === 0) {
            if (pendingPick) {
              skbParams.items = [optPickSelect];
            }
            else {
              skbParams.items = [optTakeVideo];
            }
          }
          else if (pendingPick) {
            skbParams.items = [optPickCancel];
            skbParams.items.push(optSelect);
          }
          else {
            skbParams.items = actMainList;
          }
          break;

        case LAYOUT_MODE.selection:
          control = getCurControl();
          count = controls ? control.elements.length : 0;
          skbParams.items = (selectedFileNames.length === count) ?
              [optDeselectAll] : [optSelectAll];
          if (control.elements[control.index].classList.contains('selected')) {
            skbParams.items.push(optDeselect);
          } else {
            skbParams.items.push(optSelect);
          }

          if (selectedFileNames.length > 0) {
            skbParams.items.push(optDelete, optShare);
          }
          break;

        case LAYOUT_MODE.fullscreenPlayer:
          if (pendingPick) {
            skbParams.items = actPlayerPick;
          }
          else {
            skbParams.items = actPlayer;
          }
          break;

        case SUB_MODE.infoView:
          skbParams.items = [optFileInfoBack];
          break;

        case SUB_MODE.dongleActivity:
          control = getCurControl();
          if (control && control.elements.length &&
            control.elements[control.index].classList.contains('selected')) {
            skbParams.items.push(optDeselect);
          } else {
            skbParams.items.push(optSelect);
          }
          if (selectedFileNames.length) {
            skbParams.items.push(optDonglePick);
          }
          break;
      }

      if (exports.option) {
        exports.option.initSoftKeyPanel(skbParams);
      }
      else {
        exports.option = new SoftkeyPanel(skbParams);
      }
      exports.option.show();
    },

    onPanelChanged: function _panelChanged(from, to, args) {
      curPanel = to;
      var control = getCurControl();

      if (to === LAYOUT_MODE.fullscreenPlayer) {
        setControlsColor('rgba(0, 0, 0, 0.5)');
      } else {
        setControlsColor('rgb(0,0,0)');
      }

      if (isDonglePickMultiple) {
        to = LAYOUT_MODE.selection;
      }

      switch (to) {
         case LAYOUT_MODE.selection:
           //for bug 522, to store list view's index
           if ( from == LAYOUT_MODE.list &&
             control && control.elements.length > 0 ) {
             _storeIndex = control.index;
           }
         break;

         case LAYOUT_MODE.list:
           if(control && control.elements.length > 0) {
             if ( _storeIndex != -1 ) {
               if ( _storeIndex >= control.elements.length ) {
                 _storeIndex = control.elements.length - 1;
               }
               this.setFocus(_storeIndex);
             }
             else {
               this.setFocus((control.index == -1) ? 0 : control.index);
             }
             control.elements[control.index].scrollIntoView(false);
           }
           _storeIndex = -1;
         break;

         default:
          break;
      }

      this.setSoftKeyBar(to);
    },

    navViewBack: function _navBack(evt) {
      switch (curPanel) {
        case LAYOUT_MODE.selection:
          evt && evt.preventDefault();
          hideSelectView();
        break;

        case LAYOUT_MODE.fullscreenPlayer:
          evt && evt.preventDefault();
          if(isFullScreen) {
            //back to non full screen from full screen
            switchLayout(LAYOUT_MODE.fullscreenPlayer);
            pause();
          } else {
            handleCloseButtonClick();
          }
        break;

        case LAYOUT_MODE.list:
          if (pendingPick) {
            evt && evt.preventDefault() && evt.stopPropagation();
            cancelPick();
          } else {
            NavigationMap.setSoftKeyBar(curPanel);
          }
        break;

        case SUB_MODE.infoView:
          evt && evt.preventDefault();
          hideInfoView();
          if(currentLayoutMode === LAYOUT_MODE.fullscreenPlayer) {
            NavigationMap.updateSoftKey(true);
          }
        break;
      }
    },

    scrollToElement: function _scroll(nextNode, evt) {
      if (!controls['thumbnail-views']) {
        return;
      }
      let isLastIndex = controls['thumbnail-views'].elements.length - 1 ===
        controls['thumbnail-views'].index;
      if (!listDomNode) {
        listDomNode = document.querySelector('#thumbnails');
      }
      if (nextNode.offsetTop + nextNode.offsetHeight >
        listDomNode.scrollTop + listDomNode.offsetHeight ||
        controls['thumbnail-views'].elements.item(0) === nextNode ||
        (isLastIndex && evt.key === 'ArrowDown')) {
        nextNode.scrollIntoView(false);
      } else if (nextNode.offsetTop < listDomNode.scrollTop) {
        nextNode.scrollIntoView(true);
      }
    },

    updateSkipicon: function _updateicon(isforward) {
      if (isforward === 1) {
        this.playerskipfoward.setAttribute('data-icon', 'skip-forward');
      } else {
        this.playerskipfoward.setAttribute('data-icon', 'skip-back');
      }
    },

    updateDisplay: function _updatedisplay(type) {
      if (type) {
        this.playerskipfoward.classList.remove('hidden');
        this.durationtext.classList.add('hidden');
      } else {
        this.playerskipfoward.classList.add('hidden');
        this.durationtext.classList.remove('hidden');
      }
    },

    updateFullScreenSet: function _updateSet(val) {
      if (val) {
        setControlsVisibility(false);
        exports.option.hide();
        isFullScreen = true;
      } else {
        setControlsVisibility(true);
        exports.option.show();
        isFullScreen = false;
        window.removeEventListener('keydown', fullScreenHandleClick);
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    },

    handleClick: function _handleClick(evt) {
      evt.target.click();

      if (typeof Toaster === 'undefined') {
        LazyLoader.load([
          'shared/js/media/video_stats.js',
          'shared/js/custom_dialog.js',
          'shared/js/homescreens/confirm_dialog_helper.js',
          'shared/js/toaster.js',
        ], () => {
        });
      }
    },
  };

  exports.NavigationMap = NavigationMap;

})(window);
