'use strict';

(function(exports) {
  const NAV_TYPE = Object.freeze({
    none: -1,
    menu: 0,
    dialog: 1,
    view: 2
  });
  var NavigationMap = {
    debug: debug.bind(window, 'NavigationMap'),
    currentActivatedLength: 0,
    showDialog: null,
    dialogId: null,
    lastView: null,
    focusedElement: null,
    focusedMenuElement: null,
    focusedDialogElement: null,
    navigator: null,
    focusedControls: [],
    disableNav: false,
    inProgress: false,
    init: function() {
      this.debug('init');
      NavigationMap.start();
    },

    start: function() {
      var observer = new MutationObserver(
        this.mutationsHandler.bind(this));

      observer.observe(document.body, {
        childList: false,
        attributes: true,
        characterData: true,
        subtree: true
      });

      window.addEventListener('keydown', this.keydownHandler);

      window.addEventListener('menuEvent', (e) => {
        if (e.detail.menuVisible) {
          this.focusedMenuElement = NavigationHelper.resetMenu();
        } else {
          const dialogs = ['settings-dialog', 'info-view'];
          if (dialogs.contains(NavigationMap.showDialog)) {
            return;
          }
          NavigationHelper.setFocus(
            this.focusedDialogElement || this.focusedElement
          );
          SoftkeyManager.menuEnd.call(SoftkeyManager);
        }
      });

      self = NavigationMap;

      document.addEventListener('focusChanged', (event) => {
        var element = event.detail.focusedElement;
        if('button' === element.type && element.classList.contains('menu-button'))
          return;
        if(!currentActiveDialog) {
          self.focusedElement = element;
        } else {
          self.focusedDialogElement = element;
        }
        Gallery.focusChangedHandler.call(Gallery, element, self.curIndex);
      });
    },

    // -----------------------------------
    // Mutations Handler
    // -----------------------------------
    mutationsHandler: function(mutations) {
      if(undefined === currentView) return;
      mutations.forEach( (mutation) => {
        var navType = NAV_TYPE.none;
        var target = mutation.target;
        //if dialog activated , ignore the changes
        if(currentActiveDialog) {
          navType = NAV_TYPE.none;
        }else if('attributes' === mutation.type &&
          'class' === mutation.attributeName) {
          navType = attributesHandler.call(this, target);
        }
        if(NAV_TYPE.none !== navType) {
          NavigationMap.reset(navType);
          if (typeof Dongle === 'object' && Dongle.isDonglePick) {
            resetMultiSelect();
          }
        }
      });

      function attributesHandler(target) {
        var navType = NAV_TYPE.none;
        var classes = target.classList;
        if('dialog' === target.getAttribute('role') &&
          'menu' !== target.dataset.subtype) {
            navType = NAV_TYPE.dialog;
            this.dialogId = classes && classes.contains('hidden')
            ? null : target.id;
        } else {
          if(classes && classes.contains('theme-media') &&
            !classes.contains(this.lastView)) {
            navType = NAV_TYPE.view;
            this.lastView = currentView;
          } else if(['edit-toolbar', 'crop-toolbar', 'crop-buttons', 'edit-crop-options']
            .contains(target.id)) {
            navType = NAV_TYPE.view;
          } else if(classes.contains(NEED_NAV)) {
            navType = NAV_TYPE.view;
            classes.remove(NEED_NAV);
          };
        }
        return navType;
      };
    },

    reset: function (navType) {
      if(this.currentActivatedLength) {
        this.debug('showing system dialog');
      }
      this.debug('## reset ##', navType);
      switch(navType) {
      case NAV_TYPE.dialog:
        if (typeof NavigationHelper === 'undefined') {
          return;
        }
        SoftkeyManager.setSkMenu4Dialog(this.dialogId);
        this.focusedDialogElement = NavigationHelper.reset(
          VerticalNavigator,
          this.dialogControls,
          this.getDialogFocusIndex,
          'dialog-'+this.dialogId
        );
        if(this.dialogId) {
          currentActiveDialog = $(this.dialogId);
          this.dialogId = null;
        } else {
          this.focusedDialogElement = null;
          NavigationHelper.setFocus(this.focusedElement);
          currentActiveDialog = undefined;
        }
        break;
      case NAV_TYPE.view:
          const listViews = [
            LAYOUT_MODE.list,
            LAYOUT_MODE.select,
            LAYOUT_MODE.favorite
          ];
          if (SoftkeyManager.menuVisible() && listViews.contains(currentView)) {
            return;
          }
          SoftkeyManager.setSkMenu();
          const needFavoriteViews = [
            LAYOUT_MODE.select,
            LAYOUT_MODE.fullscreen,
            LAYOUT_MODE.favorite
          ];
          if (
            Overlay.empty ||
            (Favorite.isFavoriteList && needFavoriteViews.contains(currentView))
          ) {
            return;
          }
          let noFocus = shareProcess;
          this.focusedElement = NavigationHelper.reset(
            ViewHelper.navigator,
            ViewHelper.controls,
            ViewHelper.focus,
            Gallery.fullView,
            noFocus
          );
          if (this.focusedElement) {
            if (
              !this.focusedElement.classList.contains('focus') &&
              !noFocus
            ) {
              this.focusedElement.classList.add('focus');
            }
            Gallery.focusChangedHandler.call(
              Gallery,
              this.focusedElement,
              this.curIndex
            );
            if (
              this.isFirstOrLastGroup(this.focusedElement, true) &&
              this.isFirstOrLastRow(this.focusedElement, true)
            ) {
              thumbnails.scrollTop = 0;
            }
          }
        break;
      }
    },

    handleClick: function(event) {
       if(event.target.click) {
         if(!currentActiveDialog)
            event.target.click();
         var select = document.querySelector('#settings-dialog li.focus select');
         select && select.focus();
       } else {
         var children = event.target.children;
         for (var i = 0; i < children.length; i++) {
           if(children[i].click)
             children[i].click();
         }
      }
    },

    calculateTopLeftIndex: function (currentFocusIndex) {
      let newRefreshIndex = Math.floor(currentFocusIndex / PAGE_SIZE)
        * PAGE_SIZE;
      if (Gallery.thumbnailRefreshIndex !== newRefreshIndex) {
        Gallery.thumbnailRefreshIndex = newRefreshIndex;
      }
    },

    refreshBgImage: function (refreshIndex, thumbnailImageDiv) {
      let thumbnailImageDivLength = thumbnailImageDiv.length;
      if (thumbnailImageDivLength <= 3 * PAGE_SIZE) {
        for (let i = 0; i < thumbnailImageDivLength; i++) {
          let backgroundImg = thumbnailImageDiv[i].firstElementChild;
          let fileKey = Gallery
            .numberFilesKeyCounter(backgroundImg);
          let fileinfo = FilesStore.getFileInfo(fileKey);
          addBackgroundImage(backgroundImg, fileinfo);
        }
        return;
      }

      let lastIndex, i;
      if (!refreshIndex || refreshIndex > thumbnailImageDivLength - PAGE_SIZE) {
        lastIndex = (refreshIndex + 2 * PAGE_SIZE) % thumbnailImageDivLength;
        for (i = 0; i < lastIndex; i++) {
          let backgroundImg = thumbnailImageDiv[i].firstElementChild;
          let fileKey = Gallery.numberFilesKeyCounter(backgroundImg);
          let fileinfo = FilesStore.getFileInfo(fileKey);
          addBackgroundImage(backgroundImg, fileinfo);
        }

        if (!refreshIndex) {
          lastIndex = thumbnailImageDivLength - PAGE_SIZE;
        } else {
          lastIndex = refreshIndex - PAGE_SIZE;
        }
        for (; i < lastIndex; i++) {
          removeBackgroundImage(thumbnailImageDiv[i].firstElementChild);
        }

        lastIndex = thumbnailImageDivLength;
        for (; i < lastIndex; i++) {
          let backgroundImg = thumbnailImageDiv[i].firstElementChild;
          let fileKey = Gallery.numberFilesKeyCounter(backgroundImg);
          let fileinfo = FilesStore.getFileInfo(fileKey);
          addBackgroundImage(backgroundImg, fileinfo);
        }
      } else {
        lastIndex = refreshIndex - PAGE_SIZE;
        for (i = 0; i < lastIndex; i++) {
          removeBackgroundImage(thumbnailImageDiv[i].firstElementChild);
        }

        lastIndex += 3 * PAGE_SIZE;
        if (lastIndex > thumbnailImageDivLength) {
          lastIndex = thumbnailImageDivLength;
        }
        for (; i < lastIndex; i++) {
          let backgroundImg = thumbnailImageDiv[i].firstElementChild;
          let fileKey = Gallery.numberFilesKeyCounter(backgroundImg);
          let fileinfo = FilesStore.getFileInfo(fileKey);
          addBackgroundImage(backgroundImg, fileinfo);
        }

        lastIndex = thumbnailImageDivLength;
        for (; i < lastIndex; i++) {
          removeBackgroundImage(thumbnailImageDiv[i].firstElementChild);
        }
      }

      function removeBackgroundImage(imageDiv) {
        if (imageDiv.style.backgroundImage) {
          let url = imageDiv.getAttribute('data-src');
          URL.revokeObjectURL(url);
          imageDiv.removeAttribute('data-src');
          imageDiv.style.backgroundImage = '';
        }
      }

      function addBackgroundImage(imageDiv, fileInfo) {
        if (imageDiv.style.backgroundImage || fileInfo.metadata.largeSize) {
          return;
        }
        const url = URL.createObjectURL(fileInfo.metadata.thumbnail);
        imageDiv.dataset.src = url;
        imageDiv.style.backgroundImage = 'url(' + url + ')';
      }
    },

    scrollToElement: function(element) {
      let views = [
        LAYOUT_MODE.favorite,
        LAYOUT_MODE.list,
        LAYOUT_MODE.select,
        LAYOUT_MODE.pick
      ];
      if (views.contains(currentView)
        && element.classList.contains('thumbnail')) {
        if (this.isFirstOrLastGroup(element, true)
          && this.isFirstOrLastRow(element, true)) {
          thumbnails.scrollTop = 0;
        }
        if (this.isFirstOrLastGroup(element, false)
          && this.isFirstOrLastRow(element, false)) {
          element.scrollIntoView(false);
        }
        const imageNode = element.firstElementChild;
        const fileKey = Gallery.numberFilesKeyCounter(imageNode);
        scrollToShowThumbnail(fileKey);
        let elements = null;
        if (Favorite.isFavoriteList) {
          elements = Favorite.getALLFavorites();
        } else {
          elements = NavigationMap.listControls();
        }
        const index = Array.prototype.indexOf.call(elements, element);
        if (index >= Gallery.thumbnailRefreshIndex &&
          index < Gallery.thumbnailRefreshIndex + PAGE_SIZE) {
          return;
        }
        Favorite.refreshBackground(index);
      };
    },

    isFirstOrLastGroup: function(element, judgeFirst) {
      const currentLi = element.parentNode.parentNode;
      let allLi = null;
      if (Favorite.isFavoriteList) {
        allLi = thumbnails.querySelectorAll('.hasFavorite');
      } else {
        allLi = thumbnails.querySelectorAll('li');
      }
      const liIndex = Array.prototype.indexOf.call(allLi, currentLi);
      if (judgeFirst) {
        return liIndex === 0 ? true : false;
      } else {
        return liIndex === allLi.length - 1 ? true : false;
      }
    },

    isFirstOrLastRow: function(element, judgeFirst) {
      let lists = null;
      if (Favorite.isFavoriteList) {
        lists = Favorite.getALLFavorites();
      } else {
        lists = NavigationMap.listControls();
      }
      for (let i = 1; i <= Gallery.columnCount; i++) {
        let image = judgeFirst ? lists[i - 1] : lists[lists.length - i];
        if (image && image === element) {
          return true;
        }
      }
      return false;
    },

    elementIsVisible: function(element, top, bottom) {
      var visible = false;
      if (element.offsetWidth === 0 || element.offsetHeight === 0)
        return visible;
      var rect = element.getBoundingClientRect();
      if(rect.top >= top && (rect.bottom<=window.innerHeight - bottom)) {
        visible = true;
      }
      return visible;
    },

    dialogControls: function () {
      const dialogForm = $(NavigationMap.dialogId);
      return dialogForm ? dialogForm.querySelectorAll('ul li') : null;
    },

    // get the count of photos of the current group contains
    getGroupInfo: function(navIndex, isup) {
      let curElement = NavigationHelper.controls[navIndex];
      let curElements = [];
      let curParent = curElement.parentNode;
      if (Favorite.isFavoriteList) {
        curElements = curParent.querySelectorAll(".favorite");
      } else {
        curElements = curParent.querySelectorAll(".thumbnail");
      };
      let groupInfo = {
        curGroupIndex: getCurGroupIndex(curElements, curElement),
        curGroupLen: curElements.length,
        destGroupLen: getDestGroupLen(curElement, isup)
      };
      return groupInfo;

      function getCurGroupIndex(elements, element) {
        return Array.prototype.indexOf.call(elements, element);
      }

      function getDestGroupLen(curElement, isUp) {
        const currentLi = curElement.parentNode.parentNode;
        let allLi = null;
        if (Favorite.isFavoriteList) {
          allLi = thumbnails.querySelectorAll('.hasFavorite');
        } else {
          allLi = thumbnails.querySelectorAll('li');
        }
        const liIndex = Array.prototype.indexOf.call(allLi, currentLi);
        let firstLi = allLi[0];
        let lastLi = allLi[allLi.length - 1];
        let destLi = null;
        if (isUp) {
          destLi = currentLi === firstLi ? lastLi : allLi[liIndex - 1];
        } else {
          destLi = currentLi === lastLi ? firstLi : allLi[liIndex + 1];
        }
        let destGroupChildren = [];
        if (Favorite.isFavoriteList) {
          destGroupChildren =
            destLi.lastElementChild.querySelectorAll(".favorite");
        } else {
          destGroupChildren =
            destLi.lastElementChild.querySelectorAll(".thumbnail");
        };
        return destGroupChildren.length;
      }
    },

    listControls: function() {
      return thumbnails.querySelectorAll('.thumbnail');
    },

    editControls: function() {
      return $('edit-view').querySelectorAll(
        'div:not(.hidden) > div:not(.hidden) > a, footer:not(.hidden) > a');
    },

    cropControls: function() {
      return $('crop-view').querySelectorAll('div:not(.hidden) > a');
    },

    popupMenu: function(target) {
      var classes = target.classList;
      return classes &&
        classes.contains('group-menu') &&
        classes.contains('visible');
    },

    getDialogFocusIndex: function() {
      return 0;
    },

    getListFocusIndex: function() {
      let focusIndex = Gallery.currentFocusIndex;
      if (focusIndex === NavigationHelper.controls.length) {
        return focusIndex - 1;
      } else {
        return (focusIndex < NavigationHelper.controls.length) ? focusIndex : 0;
      }
    },

    //getEditIndex
    getEditFocusIndex: function() {
      var index = 0;
      if([EDIT_SUBVIEW.home, EDIT_SUBVIEW.edited].contains(Gallery.subView)) {
        switch(Gallery.lastSubView) {
        case EDIT_SUBVIEW.exposure: index = 0; break;
        case EDIT_SUBVIEW.rotate:   index = 1; break;
        case EDIT_SUBVIEW.cropTool:
        case EDIT_SUBVIEW.cropRect: index = 2; break;
        case EDIT_SUBVIEW.filters:  index = 3; break;
        case EDIT_SUBVIEW.autoCorrect: index = 4; break;
        }
      } else if(EDIT_SUBVIEW.exposure === Gallery.subView) {
        index = 3;
      } else if(EDIT_SUBVIEW.cropTool === Gallery.subView) {
        index = Gallery.lastCropIndex !== INDEX_NULL ? Gallery.lastCropIndex : 0;
      } else if (EDIT_SUBVIEW.filters === Gallery.subView) {
        index = getFocusedFilterIndex();
      }
      NavigationMap.debug('getEditFocusIndex:', index, Gallery.lastSubView);
      return index;
    },

    get curIndex() {
      let index;
      if (Favorite.isFavoriteList) {
        index = parseInt(this.focusedElement.getAttribute('favoriteindex'));
      } else {
        let navId = this.focusedElement.getAttribute('data-nav-id');
        if (navId && navId.length > Gallery.fullView.length) {
          index = parseInt(navId.substr(Gallery.fullView.length));
        }
      }
      if (isNaN(index)) {
        index = 0;
      }
      return index;
    },

    // -----------------------------------
    // Keydown Handler
    // -----------------------------------
    keydownHandler: function(e) {
      if (NavigationMap.currentActivatedLength > 0 &&
          e.key !== 'EndCall') return;
      NavigationMap.debug('keydown:', e.key);
      var obj = SoftkeyManager;
      switch (e.key) {
        case 'Accept':
        case 'Enter':
          obj.enterKeyHandler();
          break;
        case 'BrowserBack':
        case 'Backspace':
          if (typeof Dongle === 'object' && Dongle.isDonglePick) {
            return;
          }
          if (shareProcess) {
            shareProcess = false;
            return;
          }
          obj.backKeyHandler(e);
          break;
        case 'End':
          obj.endKeyHandler();
          break;
        case 'EndCall':
          Gallery.onEndkeyHandled(e);
          break;
        default:
          const dir = NavigationHelper.Key2Dir(e.key);
          if (dir !== undefined) {
            obj.dirKeyHandler(dir)
          } else {
            obj.otherHandler(e.key)
          };
      }
    },
  };

  exports.NavigationMap = NavigationMap;
  exports.NAV_TYPE = NAV_TYPE;
})(window);
