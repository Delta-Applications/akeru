
/* exported DownloadUI */
/* global DownloadFormatter */
/* global LazyLoader */
/* global MimeMapper */

/**
 *  This file defines a component to show download confirmations
 *
 * - Stop download (Are you sure you want to stop the download?)
 * - Download stopped (Download was stopped. Try downloading again?)
 * - Download failed (xfile failed to download. Try downloading again?)
 * - Delete download (Delete xfile?)
 * - Unsupported file type
 * - File not found
 * - File open error
 * - No provider to share file
 *
 *  var request = DownloadUI.show(DownloadUI.TYPE.STOP, download);
 *
 *  request.oncancel = function() {
 *    alert('CANCEL');
 *  };
 *
 *  request.onconfirm = function() {
 *    alert('CONFIRM');
 *  };
 *
 *  WARNING: To use this library you need to include 'shared/js/l10n.js'
 *
 */
var DownloadUI = (function() {

  /**
   * Download type constructor
   *
   * @param {String} Type name
   * @param {Array} CSS classes to confirm button
   * @param {Boolean} Message without parameters
   */
  var DownloadType = function(name, classes, isPlainMessage) {
    this.name = name;
    this.classes = classes;
    this.isPlainMessage = isPlainMessage;
    this.numberOfButtons = classes.indexOf('full') !== -1 ? 1 : 2;
  };

  /**
   * Errors reported by the Downloads API.
   */
  var ERRORS = {
    NO_MEMORY: 2152857616,
    NO_SDCARD: 2152857618,
    UNMOUNTED_SDCARD: 2152857621
  };

  var TYPES = {
    STOP: new DownloadType('stop', ['danger'], true),
    STOPPED: new DownloadType('stopped', ['recommend'], true),
    FAILED: new DownloadType('failed', ['recommend']),
    DELETE: new DownloadType('delete', ['danger']),
    DELETE_ALL: new DownloadType('delete_all', ['danger']),
    UNSUPPORTED_FILE_TYPE: new DownloadType('unsupported_file_type',
                                            ['danger']),
    FILE_NOT_FOUND: new DownloadType('file_not_found', ['recommend', 'full'],
                                     true),
    FILE_OPEN_ERROR: new DownloadType('file_open_error', ['danger']),
    NO_SDCARD: new DownloadType('no_sdcard_found_2', ['recommend', 'full'],
                                true),
    UNMOUNTED_SDCARD: new DownloadType('unmounted_sdcard_2', ['recommend',
                                       'full'], true),
    NO_PROVIDER: new DownloadType('no_provider', ['recommend', 'full'], true),
    NO_MEMORY: new DownloadType('no_memory', ['recommend', 'full'], true)
  };

  var DownloadAction = function(id, type) {
    this.id = id;
    this.name = id.toLowerCase();
    this.title = this.name + '_downloaded_file';
    this.type = type;
  };

  var ACTIONS = {
    OPEN: new DownloadAction('OPEN', 'confirm'),
    SHARE: new DownloadAction('SHARE', 'confirm'),
    WALLPAPER: new DownloadAction('WALLPAPER', 'confirm'),
    RINGTONE: new DownloadAction('RINGTONE', 'confirm'),
    CANCEL: new DownloadAction('CANCEL', 'cancel')
  };

  // Confirm dialog containers
  var confirm = null;
  var actionMenu = null;

  //new add
  var downloadConfirmDialog = null;
  var downloadsContainer = null;
  var skNo =
  {
      name: 'No',
      l10nId: 'stop_download_left_button',
      priority: 1,
      method: null
  };
  var skYes =
  {
      name: 'Yes',
      l10nId: 'stop_download_right_button',
      priority: 3,
      method: null
  };
  var skOk =
  {
      name: 'Ok',
      l10nId: 'ok',
      priority: 2,
      method: null
  };
  var skLCancel =
  {
      name: 'Cancel',
      l10nId: 'cancel',
      priority: 1,
      method: null
  };
  var skRDelete =
  {
      name: 'Delete',
      //l10nId: 'stop',
      priority: 3,
      method: null
  };
  var skRResume =
  {
      name: 'Resume',
      //l10nId: 'stop',
      priority: 3,
      method: null
  };
  var stopDownloadSoftKeyBar = {
        header: { l10nId:'message' },
        items: [skNo,skYes]
  };
  var resumeDownloadSoftKeyBar = {
        header: { l10nId:'message' },
        items: [skLCancel,skRResume]
  };
  var noDownloadSoftKeyBar = {
        header: { l10nId:'message' },
        items: [skOk]
  };
  var deleteDownloadSoftKeyBar = {
        header: { l10nId:'message' },
        items: [skLCancel,skRDelete]
  };
  var unsupportDownloadSoftKeyBar = {
        header: { l10nId:'message' },
        items: [skLCancel,skRDelete]
  };
 /**
  * Request auxiliary object to support asynchronous calls
  */
  var Request = function() {
    this.cancel = function() {
      removeContainers();
      if (typeof this.oncancel === 'function') {
        this.oncancel();
      }
    };

    this.confirm = function(result) {
      removeContainers();
      if (typeof this.onconfirm === 'function') {
        this.result = result;
        this.onconfirm({
          target: this
        });
      }
    };
  };

  function removeContainers() {
    removeConfirm();
    removeActionMenu();
  }

  function addConfirm() {
    if (confirm !== null) {
      confirm.innerHTML = '';
      return;
    }

    confirm = document.createElement('form');
    confirm.id = 'downloadConfirmUI';
    confirm.setAttribute('role', 'dialog');
    confirm.setAttribute('data-type', 'confirm');
    document.body.appendChild(confirm);
  }

  function removeConfirm() {
    if (confirm === null) {
      return;
    }

    confirm.innerHTML = '';
    confirm.style.display = 'none';
  }

  // When users click or hold on home button UIs should be removed
  window.addEventListener('home', removeContainers);
  window.addEventListener('holdhome', removeContainers);

  function l10n(element, l10nid, l10nargs) {
    // First set our args.
    if(l10nid === 'stopped_download_message'){
      l10nid = 'kai-stopped_download_message';
    }
    if (l10nargs) {
      element.setAttribute('data-l10n-args', JSON.stringify(l10nargs));
    }
    // Then localize.
    element.setAttribute('data-l10n-id', l10nid);
    return element;
  }

  function createConfirm(type, req, downloads) {
    var title;
    var message;
    var dialogConfig;
    var argsStr = null;

    title = type.name + '_download_title';

    if (type.isPlainMessage) {
      message = type.name + '_download_message';
    } else {
      if (type === TYPES.DELETE_ALL) {
        argsStr = downloads.length;
        message = type.name + '_download_message_ext';
      } else {
        argsStr = DownloadFormatter.getFileName(downloads[0]);
        message = type.name + '_download_message';
      }
    }

    if(type.name === "file_not_found"){
      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {argsStr} },
        accept: {
          l10nId: 'ok',
          priority: 3,
          callback: function() {
            dialog.destroy();
          },
        }
      };
    }else if(type.name === "unsupported_file_type" || type.name === "file_open_error"){
      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {argsStr} },
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            req.cancel();
            dialog.destroy();
          },
        },
        confirm: {
          l10nId: 'downloads-delete',
          priority: 3,
          callback: function() {
            req.confirm();
            dialog.destroy();
          },
        }
      };
    }else if(type.name === "delete"){
      var downPanel = document.getElementById('downloads');
      //downPanel.classList.remove('edit');

      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {name: argsStr} },
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            req.cancel();
            //downPanel.classList.remove('edit');
            dialog.destroy();
          },
        },
        confirm: {
          l10nId: 'delete',
          priority: 3,
          callback: function() {
            req.confirm();
            //downPanel.classList.remove('edit');
            dialog.destroy();

            var downLoadList = document.getElementById('downloadList');
            var focusedElement = document.querySelector("#downloads .focus");

            if(focusedElement == null){
              downLoadList.firstElementChild.childNodes[0].classList.add('focus');
            }
          },
        },
        backcallback: function() {
          dialog.destroy();
        }
      };
    }else if(type.name === "delete_all"){
      var downPanel = document.getElementById('downloads');

      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {argsStr} },
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            req.cancel();
            //downPanel.classList.remove('edit');
            dialog.destroy();
          },
        },
        confirm: {
          l10nId: 'delete',
          priority: 3,
          callback: function() {
            req.confirm();
            //downPanel.classList.remove('edit');
            dialog.destroy();

            var downLoadList = document.getElementById('downloadList');
            var focusedElement = document.querySelector("#downloads .focus");

            if(focusedElement == null){
              downLoadList.firstElementChild.childNodes[0].classList.add('focus');
            }
          },
        },
        backcallback: function() {
          dialog.destroy();
        }
      };
    }else if(type.name === "stop"){
      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {argsStr} },
        cancel: {
          l10nId: 'stop_download_left_button',
          priority: 1,
          callback: function() {
            req.cancel();
            dialog.destroy();
          },
        },
        confirm: {
          l10nId: 'stop_download_right_button',
          priority: 3,
          callback: function() {
            req.confirm();
            dialog.destroy();
          },
        }
      };
    }else if(type.name === "stopped" || type.name === "failed"){
      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {argsStr} },
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            req.cancel();
            dialog.destroy();
          },
        },
        confirm: {
          l10nId: 'download-resume',
          priority: 3,
          callback: function() {
            req.confirm();
            dialog.destroy();
          },
        }
      };
    }else{
      dialogConfig = {
        title: { id: title, args: {} },
        body: { id: message, args: {argsStr} },
        confirm: {
          l10nId: 'ok',
          priority: 2,
          callback: function() {
            dialog.destroy();
          },
        }
      };
    }

    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('app-confirmation-dialog'));
 }


  function _changeDownloadListFocus(){
    var event = new CustomEvent('panelready',{
      detail:{
        current:Settings.currentPanel
      }
    });
    window.dispatchEvent(event);
  }
  function addActionMenu() {
    if (actionMenu !== null) {
      actionMenu.innerHTML = '';
      return;
    }

    actionMenu = document.createElement('form');
    actionMenu.id = 'downloadActionMenuUI';
    actionMenu.setAttribute('role', 'dialog');
    actionMenu.setAttribute('data-type', 'action');
    document.body.appendChild(actionMenu);
  }

  function removeActionMenu() {
    if (actionMenu === null) {
      return;
    }

    actionMenu.innerHTML = '';
    actionMenu.style.display = 'none';
  }

  function createActionMenu(req, download) {
    var actions = [ACTIONS.SHARE];

    var fileName = DownloadFormatter.getFileName(download);
    var type = MimeMapper.guessTypeFromFileProperties(fileName,
                                                      download.contentType);
    if (type.length > 0) {
      if (type.startsWith('image/')) {
        actions.push(ACTIONS.WALLPAPER);
      } else if (type.startsWith('audio/')) {
        actions.push(ACTIONS.RINGTONE);
      }
    }

    actions.push(ACTIONS.CANCEL);
    doCreateActionMenu(req, fileName, actions);
  }

  function doCreateActionMenu(req, fileName, actions) {
    addActionMenu();

    var header = document.createElement('header');
    header.textContent = "";//fileName;
    actionMenu.appendChild(header);

    var menu = document.createElement('menu');
    menu.classList.add('actions');

    actions.forEach(function addActionButton(action) {
      var button = document.createElement('button');
      button.id = action.id;
      l10n(button, action.title);
      button.dataset.type = action.type;
      menu.appendChild(button);
      button.addEventListener('click', function buttonCliked(evt) {
        button.removeEventListener('click', buttonCliked);
        req[evt.target.dataset.type](ACTIONS[evt.target.id]);
      });
    });

    actionMenu.appendChild(menu);

    actionMenu.style.display = 'block';
  }

  /*
   * Shows a confirmation depending on type. It returns a request object with
   * oncancel and onconfirm callbacks
   *
   * @param {String} Confirmation type
   *
   * @param {Array} It represents the download(s) object(s)
   */
  function show(type, downloads) {
    var req = new Request();

    downloads = Array.isArray(downloads) ? downloads : [downloads];

    window.setTimeout(function() {
      var libs = ['shared/js/download/download_formatter.js'];

      // We have to discover the type of UI depending on state when type is null
      if (type === null) {
        type = TYPES.STOPPED;

        var download = downloads[0];
        if (download.state === 'finalized' ||
            download.state === 'stopped' && download.error !== null) {
          type = TYPES.FAILED;
        }
      }

      LazyLoader.load(libs, createConfirm.call(this, type, req, downloads));
    }, 0);

    return req;
  }

  function showActions(download) {
    var req = new Request();

    window.setTimeout(function() {
      LazyLoader.load(['shared/js/mime_mapper.js',
                       'shared/js/download/download_formatter.js',
                       'shared/style/action_menu.css'],
                      createActionMenu.call(this, req, download));
    }, 0);

    return req;
  }

  return {
    show: show,

    showActions: showActions,

    hide: removeContainers,

    get ERRORS() {
      return ERRORS;
    },

    get TYPE() {
      return TYPES;
    }
  };
}());
