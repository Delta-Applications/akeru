'use strict';

function shareItems() {
  if (currentView === LAYOUT_MODE.select) { // share selected items
    let IMGS = thumbnails.querySelectorAll('.selected.thumbnail-list-img');
    let largeImageNames = [];
    let shareImageNames = [];
    if (IMGS.length < 1) {
      return;
    };
    Array.forEach(IMGS, function (IMG) {
      if (IMG.fileData.metadata.largeSize) {
        largeImageNames.push(IMG.fileData.name);
      } else {
        shareImageNames.push(IMG.fileData.name);
      };
    });
    let blobs = shareImageNames.map(function(name) {
      return selectedFileNamesToBlobs[name];
    });
    if (largeImageNames.length > 0) {
      Message.show('kai-some-photos-not-share');
    };
    share(blobs);
  } else { // share current items
    let fileinfo = FilesStore.getFileInfo(FilesStore.currentFileKey);
    photodb.getFile(fileinfo.name, function(blob) {
      share([blob]);
    });
  }
}

function resetMultiSelect () {
  thumbnails.setAttribute('mode', 'multi-select');
  Array.forEach(thumbnails.querySelectorAll('.thumbnail-list-img'),
    function (item) {
      item.dataset.selected = false;
      item.checkBoxContainerNode.setAttribute('data-icon', 'check-off');
    });
}

function selectAllPhotos() {
  var selectedNum = 0;
  let IMGS = null;
  if (Favorite.isFavoriteList) {
    IMGS = Favorite.getALLFavorites();
  } else {
    IMGS = NavigationMap.listControls();
  }
  selectedFileNames = [];
  selectedFileNamesToBlobs = {};
  selectedInvalid = 0;
  if (isSelectAll) {
    Gallery.isTriggerAll = true;
    Array.forEach(IMGS,
      function (IMG) {
        IMG = IMG.firstElementChild;
        IMG.classList.add('selected');
        IMG.dataset.selected = true;
        IMG.checkBoxContainerNode.setAttribute('data-icon', 'check-on');
        selectedFileNames.push(IMG.fileData.name);
        photodb.getFile(IMG.fileData.name, function(file) {
          selectedFileNamesToBlobs[ IMG.fileData.name ] = file;
        });
        if (IMG.parentNode.classList.contains("largeSize")) {
          selectedInvalid++;
        }
      });
    selectedNum = IMGS.length;
    SoftkeyManager.setSkMenu();
    SoftkeyManager.updateSkText('kai-deselect-all');
  }
  else {
    Gallery.isTriggerAll = false;
    Array.forEach(IMGS,
      function(IMG) {
        IMG = IMG.firstElementChild;
        IMG.classList.remove('selected');
        IMG.dataset.selected = false;
        IMG.checkBoxContainerNode.setAttribute('data-icon', 'check-off');
      });
    SoftkeyManager.setSkMenu();
    SoftkeyManager.updateSkText('kai-select-all');
  }
  updateMultipleCount(selectedNum);
  isSelectAll = !isSelectAll;
  Gallery.setSelectSubView(!isSelectAll?"all":"");
}

function resetSelection() {
  selectedFileNames = [];
  selectedFileNamesToBlobs = {};
  updateMultipleCount(0);
  resetMultiSelect();
}

function cleanSelectStates() {
  selectedInvalid = 0;
  isSelectAll = true;
  Gallery.isTriggerAll = false;
}

function updateMultipleCount(count) {
  navigator.mozL10n.setAttributes(
    $('multiple-select-count'),
    'kai-selected-items-count',
    { n: count }
  );
}

// multiple select -- delete selected photos
function deleteSelectedPhotos() {
  Gallery.deleteFiles =
    thumbnails.querySelectorAll('.selected.thumbnail-list-img');
  if (Gallery.deleteFiles.length < 1) {
    return;
  };
  var dialogConfig = {
    title: { id: 'kai-confirmation', args: {} },
    body: { id: Gallery.deleteFiles.length > 1
      ? 'kai-delete-selected-images' : 'kai-delete-selected-image', args: {} },
    cancel: {
      l10nId: 'cancel',
      callback: function() {},
    },
    confirm: {
      l10nId:'delete',
      callback: function() {
        Gallery.deleteSelected = true;
        window.addEventListener('keydown', keydownHandler, true);
        document.getElementById('mask-background').classList.remove('hidden');
        SoftkeyManager.softkey.hide();
        setView(Gallery.lastView);
        NavigationMap.inProgress = true;
        listProgressBar.value = 0;
        listProgressBar.classList.remove('hidden');
        let storage = navigator.getDeviceStorage('pictures');
        for (let i = 0; i < Gallery.deleteFiles.length; i++) {
          let fileData = Gallery.deleteFiles[i].fileData;
          deleteSeletedFiles(storage, fileData);
        };
      },
    },
  };
  confirmDialog(dialogConfig);
}

function deleteSeletedFiles(storage, fileData) {
  let name = fileData.name;
  let metadata = fileData.metadata;
  let deleteRequest = storage.delete(name);
  deleteRequest.onsuccess = () => {
    Gallery.deleteSuccessFiles.push(fileData);
    let successCount =  Gallery.deleteSuccessFiles.length;
    let errorCount = Gallery.deleteErrorFiles.length;
    let deletedCount = successCount + errorCount;
    if (deletedCount !== Gallery.deleteFiles.length) {
      return;
    };
    for (let i = 0; i < successCount; i++) {
      let fileData = Gallery.deleteSuccessFiles[i];
      let deleteImage = fileData.thumbnailContainer;
      let deleteImgFileKey = Gallery.numberFilesKeyCounter(deleteImage);
      let fileInfo = FilesStore.getFileInfo(deleteImgFileKey);
      thumbnailList.removeItem(fileInfo);
      FilesStore.deteleFileInfo(deleteImgFileKey);
      listProgressBar.value =
        parseInt(100 * i / successCount);
    };
    deleteDone(successCount);
  };
  deleteRequest.onerror = (e) => {
    Gallery.deleteErrorFiles.push(fileData);
    console.error('Failed to delete', name,
      'from DeviceStorage:', e.target.error);
  };
  if (metadata.preview && metadata.preview.filename) {
    storage.delete(metadata.preview.filename);
  };
}

function deleteDone(deleteFilesCount) {
  Message.show('kai-deleted-n-photos', deleteFilesCount);
  listProgressBar.classList.add('hidden');
  NavigationMap.inProgress = false;
  document.getElementById('mask-background').classList.add('hidden');
  if (Favorite.isFavoriteList) {
    let allThumbnails = Favorite.getALLFavorites();
    if (!allThumbnails.length) {
      Favorite.showEmptyLayer();
    } else {
      Favorite.favoriteViewDeleteImg();
      Favorite.refreshBackground(Gallery.currentFocusIndex);
    }
  } else {
    let allThumbnails = NavigationMap.listControls();
    if (!allThumbnails.length) {
      if (Gallery.creatingThumbnails) {
        Overlay.show('scanning');
      } else {
        Overlay.show('emptygallery');
      }
    } else {
      Favorite.refreshBackground(Gallery.currentFocusIndex);
    }
  }
  SoftkeyManager.softkey.show();
  needNav();
  Gallery.deleteErrorFiles = [];
  Gallery.deleteFiles = [];
  Gallery.deleteSuccessFiles = [];
  Gallery.deleteSelected = false;
  window.removeEventListener('keydown', keydownHandler, true);
}

function keydownHandler(e) {
  switch (e.key) {
    case 'BrowserBack':
    case 'Backspace':
      SoftkeyManager.backKeyHandler(e);
      break;
    default:
      e.preventDefault();
      e.stopPropagation();
      break;
  }
}

function chkIsCurrentLarge() {
  let fileinfo = FilesStore.getFileInfo(FilesStore.currentFileKey);
  if (fileinfo && fileinfo.metadata &&
      fileinfo.metadata.largeSize) {
    return true;
  }
  return false;
}

function updateMetadata(fileName, metadata, callback) {
  photodb.updateMetadata(fileName, metadata, callback);
}

function deleteSingleItem() {
  let fileinfo = FilesStore.getFileInfo(FilesStore.currentFileKey);
  let dialogConfig = {
    title: { id: 'kai-confirmation', args: {} },
    body: { id: currentView === LAYOUT_MODE.fullscreen
      ? 'kai-delete-this-image' :'kai-delete-selected-image', args: {} },
    backcallback: function() {},
    cancel: {
      l10nId:'cancel',
      callback: function() {},
    },
    confirm: {
      l10nId:'delete',
      callback: function() {
        if (currentView === LAYOUT_MODE.fullscreen) {
          window.performance.mark('gallery-delete-start');
        }
        window.addEventListener('filedeleted', singleDeleteDone);
        deleteFile(fileinfo.name, fileinfo.metadata);
        Message.show('kai-single-image-deleted');
      },
    },
  };
  confirmDialog(dialogConfig);

  function singleDeleteDone() {
    window.removeEventListener('filedeleted', singleDeleteDone);
    needNav();
  }
}

function createMultipleSelectInput(imgNode) {
  var checkBoxContainerNode = document.createElement('div');
  checkBoxContainerNode.classList.add('check-icon');
  checkBoxContainerNode.classList.add('hidden');
  checkBoxContainerNode.setAttribute('data-icon', 'check-off');
  imgNode.checkBoxContainerNode = checkBoxContainerNode;
  imgNode.appendChild(checkBoxContainerNode);
}
