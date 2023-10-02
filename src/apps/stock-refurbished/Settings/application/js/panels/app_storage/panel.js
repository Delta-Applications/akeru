
/**
 * AppStorageList is a singleton that caches app storage values for
 * app storage list and root panel fast access
 */
define('panels/app_storage/app_storage_list',['require','modules/apps_cache','shared/manifest_helper','modules/app_storage'],function(require) {
  
  var AppsCache = require('modules/apps_cache');
  var ManifestHelper = require('shared/manifest_helper');
  var AppStorage = require('modules/app_storage');

  /**
   * The app name in the gecko database
   */
  var IDB_NAME_MAP = {
    'contact': '3406066227csotncta',
    'sms': '226660312ssm'
  };

  const RETRY_TIMES = 5;
  const APP_INTERVAL_TIME = 2000;
  const APP_DEFAULT_SIZE = 1024;

  var APP_COLOR = ['#ff8329', '#f53d16', '#644237', '#8c8c8c', '#4f6a79',
                   '#e82928', '#da0051', '#af0779', '#840fa2', '#5026aa',
                   '#2f3da7', '#2383f2', '#1e98f2', '#25afca', '#1e8675',
                   '#47a13a', '#7eb832', '#c3d51c', '#fde61b', '#fab200'];

  var AppStorageList = function sl() {
    this._listRoot = null;
    this._apps = null;
    this._files = null;
    this._getAppDone = null;
    this._getFileDone = null;
    this._getFileTimes = null;
    this._getFirstSize = null;
    this._appsUsed = null;
    this._isSupportSTK = true;
  };

  AppStorageList.prototype = {
    init: function sl_init(listRoot) {
      this._listRoot = listRoot;
      this._apps = [];
      this._files = [];
      this._getAppDone = false;
      this._getFileDone = false;
      this._getFileTimes = 0;
      this._appsUsed = 0;
      this.loadApps();
      this.getFileList();
    },

    loadApps: function sl_getAllApps() {
      this._getAppDone = false;
      var self = this;
      AppsCache.apps().then(function (apps) {
        for (var i = 0; i < apps.length; i++) {
          var app = apps[i];
          var manifest = app.manifest ? app.manifest : app.updateManifest;
          if (app.origin === 'app://settings.gaiamobile.org' ||
            manifest.role === 'system' || manifest.role === 'input' ||
            manifest.role === 'theme' || manifest.role === 'homescreen' ||
            manifest.role === 'invisible' || app.role === 'invisible') {
            continue;
          }
          app.size = 0;
          self._apps.push(app);
        }
        self._getAppDone = true;
        self.renderList();
      })
    },

    renderList:function sl_renderList() {
      if (!(this._getFileDone && this._getAppDone)) {
        return;
      }

      this._apps.forEach((app) => {
        this._files.forEach(function (file) {
          if (app.installOrigin.indexOf(file.name) >= 0) {
            app.size = file.size;
            this._appsUsed = this._appsUsed + file.size;
          };
        });
        app.size = app.size + APP_DEFAULT_SIZE;
        this._appsUsed = this._appsUsed + APP_DEFAULT_SIZE;
      });

      this._apps.sort(function alphabeticalSort(app, otherApp) {
        return (app.size ? app.size : 0) < (otherApp.size ? otherApp.size : 0);
      });

      this.renderAppList();
    },

    renderAppList: function sl_renderAppList() {
      document.getElementById('application-list').hidden = false;
      this._listRoot.innerHTML = '';
      var rootElement = document.createElement('ul');
      this._listRoot.appendChild(rootElement);

      var stackedbarDiv = document.createElement('div');
      stackedbarDiv.classList.add('space-stackedbar');
      stackedbarDiv.id = 'sdcard-space-stackedbar';
      var li = document.createElement('li');
      li.id = 'stacked-bar';
      li.classList.add('non-focus');
      li.appendChild(stackedbarDiv);
      rootElement.appendChild(li);
      this.stackedbar = StackedBar(stackedbarDiv);
      this.stackedbar.reset();
      var listFragment = document.createDocumentFragment();

      var self = this;
      this._apps.forEach(function appIterator(app, index) {
        if (app.origin === 'app://stk.gaiamobile.org') {
          if (!self._isSupportSTK) {
            return;
          }
        }
        var manifest = new ManifestHelper(app.manifest ?
          app.manifest : app.updateManifest);
        var li = self._genAppItemTemplate({
          name: manifest.short_name || manifest.name,
          index: index,
          size: app.size
        });
        index++;
        listFragment.appendChild(li);
      });
      listFragment.appendChild(this.renderOther());
      listFragment.appendChild(this.renderFree());
      listFragment.appendChild(this.renderTotal());
      rootElement.appendChild(listFragment);
      this.stackedbar.refreshUI();

      var listElements = document.querySelectorAll('#applicationStorage li');
      ListFocusHelper.addEventListener(listElements);
      document.getElementById('application-data-ul').hidden = true;
      NavigationMap.refresh();
    },

    renderOther: function () {
      var li = document.createElement('li');
      li.classList.add('none-select');
      li.id = 'color-app-other';
      li.classList.add('color-app-other');
      li.classList.add('none-select');
      var label = document.createElement('span');
      label.classList.add('stackedbar-color-label');
      var anchor = document.createElement('a');
      var size = document.createElement('span');
      size.classList.add('size');
      var text = document.createElement('span');
      text.setAttribute('data-l10n-id', 'other-space');
      anchor.appendChild(text);
      anchor.appendChild(size);
      var otherSize = AppStorage.storage.usedSize - this._appsUsed;
      DeviceStorageHelper.showFormatedSize(
        size, 'storageSize', otherSize);
      this.stackedbar.add({ 'index': 'other', 'value': otherSize });
      li.appendChild(label);
      li.appendChild(anchor);
      return li;
    },

    renderFree: function () {
      var li = document.createElement('li');
      li.classList.add('none-select');
      li.id = 'color-app-free';
      li.classList.add('color-app-free');
      li.classList.add('none-select');
      var label = document.createElement('span');
      label.classList.add('stackedbar-color-label');
      var anchor = document.createElement('a');
      var size = document.createElement('span');
      size.classList.add('size');
      var text = document.createElement('span');
      text.setAttribute('data-l10n-id', 'free-space');
      anchor.appendChild(text);
      anchor.appendChild(size);
      var freeSize = AppStorage.storage.freeSize;
      DeviceStorageHelper.showFormatedSize(
        size, 'storageSize', freeSize);
      this.stackedbar.add({ 'index': 'free', 'value': freeSize});
      li.appendChild(label);
      li.appendChild(anchor);
      return li;
    },

    renderTotal: function () {
      var li = document.createElement('li');
      li.classList.add('none-select');
      var anchor = document.createElement('a');
      var size = document.createElement('span');
      size.classList.add('size');
      var text = document.createElement('span');
      text.setAttribute('data-l10n-id', 'apps-total-space');
      anchor.appendChild(text);
      anchor.appendChild(size);
      DeviceStorageHelper.showFormatedSize(
        size, 'storageSize', AppStorage.storage.totalSize);
      li.appendChild(anchor);
      return li;
    },

    _genAppItemTemplate: function pl__genAppItemTemplate(itemData) {
      var li = document.createElement('li');
      var label = document.createElement('span');
      label.classList.add('stackedbar-color-label');
      label.style.backgroundColor =
        APP_COLOR[itemData.index % APP_COLOR.length];
      var anchor = document.createElement('a');
      var size = document.createElement('span');
      size.classList.add('size');
      size.hidden = true;
      var text = document.createElement('span');
      text.textContent = itemData.name;
      anchor.appendChild(text);
      anchor.appendChild(size);
      li = document.createElement('li');
      li.id = 'color-app-' + itemData.index;
      li.index = itemData.index;

      var stackedbarSize = itemData.size ? itemData.size : 0;
      DeviceStorageHelper.showFormatedSize(
        size, 'storageSize', stackedbarSize);
      size.hidden = false;
      this.stackedbar.add({ 'index': itemData.index, 'value': stackedbarSize});
      li.appendChild(label);
      li.appendChild(anchor);
      return li;
    },


    renderAppSize:function sl_renderAppSize(app, oldSize) {
      var releasedSize = oldSize - app.size;
      DeviceStorageHelper.showFormatedSizeOfReleased(releasedSize);
      this._appsUsed = this._appsUsed - oldSize + app.size;
      this.renderAppList();
    },

    getAppSize: function (app) {
      this._getFileDone = false;
      var oldSize = app.size;
      var req = navigator.getDeviceStorage('apps-storage');
      if (!req) {
        console.warn("No permissions");
        this._getFileTimes++;
        if (this._getFileTimes > RETRY_TIMES) {
          this._getFileDone = true;
          this.renderList();
          return;
        }
        this.getAppSize(app);
      }
      var self = this;
      var appSize = 0;
      var result = req.enumerate();
      result.onsuccess = function () {
        var file = result.result;
        if (file) {
          if (file.name) {
            if (file.name.indexOf('default') === 0) {
              file.appName = file.name.substring(file.name.indexOf('+++') + 3,
                file.name.indexOf('.gaiamobile.org'));
            } else {
              for (var key in IDB_NAME_MAP) {
                var idbName = IDB_NAME_MAP[key];
                if (file.name.indexOf(idbName) > 0 &&
                  file.name.substr(-4, 4) !=='-shm' &&
                  file.name.substr(-4, 4) !=='-wal') {
                  file.appName = key;
                  break;
                }
              }
            }
            if (app.installOrigin.indexOf(file.appName) >= 0) {
              appSize = appSize + file.size;
            }
            this.continue();
          }
        } else {
          if (self._getFirstSize === appSize) {
            self._getFileDone = true;
            app.size = appSize;
            self.renderAppSize(app, oldSize);
          } else {
            setTimeout(function () {
              self._getFirstSize = appSize;
              self.getAppSize(app);
            }, APP_INTERVAL_TIME);
          }
        }
      };

      result.onerror = function () {
        console.warn("No file found: " + this.error);
        self._getFileTimes++;
        if (self._getFileTimes > RETRY_TIMES) {
          self._getFileDone = true;
          self.renderList();
          return;
        }
        self._getFileTimes++;
        self.getAppSize(app);
      }
    },

    getFileList: function sl_getFileList() {
      this._getFileDone = false;
      var req = navigator.getDeviceStorage('apps-storage');
      if (!req) {
        console.warn("No permissions");
        this._getFileTimes++;
        if (this._getFileTimes > RETRY_TIMES) {
          this._getFileDone = true;
          this.renderList();
          return;
        }
        this.getFileList();
      }
      var self = this;
      var result = req.enumerate();
      result.onsuccess = function () {
        var file = result.result;
        if (file) {
          if (file.name) {
            if (file.name.indexOf('default') === 0) {
              file.appName = file.name.substring(file.name.indexOf('+++') + 3,
                file.name.indexOf('.gaiamobile.org'));
              self.updateFileList(file);
            } else {
              for (var key in IDB_NAME_MAP) {
                var idbName = IDB_NAME_MAP[key];
                if (file.name.indexOf(idbName) > 0 &&
                  file.name.substr(-4, 4) !=='-shm' &&
                  file.name.substr(-4, 4) !=='-wal') {
                  file.appName = key;
                  self.updateFileList(file);
                  break;
                }
              }
            }
            this.continue();
          }
        } else {
          self._getFileDone = true;
          self.renderList();
        }
      };

      result.onerror = function () {
        console.warn("No file found: " + this.error);
        self._getFileTimes++;
        if (self._getFileTimes > RETRY_TIMES) {
          self._getFileDone = true;
          self.renderList();
          return;
        }
        self.getFileList();
      };
    },

    updateAppSize: function sl_updateAppSiize(app) {
      this._getFileTimes = 0;
      this._getFirstSize = 0;
      this.getAppSize(app);
    },

    updateFileList: function sl_updateFileList(file) {
      var fileArr = {};
      fileArr.name = file.appName;
      fileArr.size = file.size;
      if (this._files.length > 0) {
        for (var i = 0; i < this._files.length; i ++ ) {
          if (this._files[i].name === file.appName) {
            this._files[i].size = this._files[i].size + file.size;
            return;
          }
        }
        this._files.push(fileArr);
      } else {
        this._files.push(fileArr);
      }
    }
  }

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
        container.hidden = false;
        var totalWidths = 100;
        items.forEach(function(item) {
          var width = 0;
          if ((item.value > 0) &&
            ((item.value * 100 ) / totalSize) < (1 * 100 / clientWidth)) {
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

        items.forEach(function(item) {
          var ele = container.querySelector('#color-app-' + item.index);
          if (!ele) {
            ele = document.createElement('span');
            if (item.index === 'other' || item.index === 'free') {
              ele.classList.add('color-app-' + item.index);
            } else {
              ele.style.backgroundColor =
                APP_COLOR[item.index % APP_COLOR.length];
            }
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

  return function ctor_storage_list() {
    return new AppStorageList();
  };
});


/* global DeviceStorageHelper */
/**
 * Used to show Storage/App Storage panel
 */
define('panels/app_storage/panel',['require','modules/settings_panel','panels/app_storage/app_storage_list'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var AppStorageList = require('panels/app_storage/app_storage_list');

  return function ctor_app_storage_panel() {
    var _applist = null;
    var systemCleaning = false;
    var settingsCleaning = false;
    var AppStorageListModule = AppStorageList();
    var _settings = window.navigator.mozSettings;
    var _contacts = window.navigator.mozContacts;
    var _message = window.navigator.mozMobileMessage;
    const APP_SWITCH = {
      'app://clock.gaiamobile.org' : 'alarm.enabled'
    };

    const APP_SYNC = {
      'app://calendar.gaiamobile.org' : 'calendarSyncEnable',
      'app://contact.gaiamobile.org' : 'contactsSyncEnable',
      'app://email.gaiamobile.org': 'emailSyncEnable'
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
          var li = document.querySelector('li.focus');
          AppStorageListModule._apps[li.index].launch();
          if (window.ActivityHandler) {
            ActivityHandler.postResult();
          }
        }
      },
      {
        name: 'Clean',
        l10nId: 'clean',
        priority: 3,
        method: function() {
          _showDialog();
        }
      }]
    };

    function cleanContactsData(app) {
      let options = {type: 'device'}
      let req = _contacts.clear(options);
      req.onsuccess = () => {
        settingsCleaning = false;
        updateDisplay(app);
      };
      req.onerror = () => {
        settingsCleaning = false;
        updateDisplay(app);
      }
    }

    function cleanSmsData(app) {
      var msgList = [];
      var cursor = _message.getMessages(null, false);
      cursor.onsuccess = () => {
        if (cursor.result) {
          msgList.push(cursor.result.id);
          cursor.continue();
        } else {
          if (msgList.length > 0) {
            var req = _message.delete(msgList);
            req.onsuccess = () => {
              settingsCleaning = false;
              updateDisplay(app);
            };
            req.onerror = () => {
              settingsCleaning = false;
              updateDisplay(app);
            };
          } else {
            settingsCleaning = false;
            updateDisplay(app);
          }
        }
      };

      cursor.onerror = () => {
        settingsCleaning = false;
        updateDisplay(app);
      };
    }

    function cleanOtherData(app) {
      settingsCleaning = true;
      if (app.origin === 'app://contact.gaiamobile.org') {
        cleanContactsData(app);
      } else if (app.origin === 'app://sms.gaiamobile.org') {
        cleanSmsData(app);
      } else {
        settingsCleaning = false;
      }
    }


    function restoreSettingsDB(app) {
      if (APP_SWITCH[app.origin]) {
        var obj = {};
        obj[APP_SWITCH[app.origin]] = false;
        _settings.createLock().set(obj);
      } else if (APP_SYNC[app.origin]) {
        getSetting(APP_SYNC[app.origin]).then((value) => {
          for (var key in value) {
            value[key] = false;
          }
          var obj = {};
          obj[APP_SYNC[app.origin]] = value;
          _settings.createLock().set(obj);
        });
      }
    }

    function updateDisplay(app) {
      if (!systemCleaning && !settingsCleaning) {
        AppStorageListModule.updateAppSize(app);
      }
    }

    function _showDialog() {
      var dialogConfig = {
        title: {
          id: 'confirmation',
          args: {}
        },
        body: {
          id: 'application-data-delete',
          args: {}
        },
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Delete',
          l10nId: 'delete',
          priority: 3,
          callback: function() {
            document.getElementById('application-data-ul').hidden = false;
            document.getElementById('application-list').hidden = true;
            SettingsSoftkey.hide();
            navigator.mozApps.getSelf().onsuccess = (evt) => {
              var app = evt.target.result;
              var li = document.querySelector('li.focus');
              var info = {};
              var cleanApp = AppStorageListModule._apps[li.index];
              info.origin = cleanApp.origin;
              cleanOtherData(cleanApp);
              restoreSettingsDB(cleanApp);
              systemCleaning = true;
              app.connect('application-data-comms').then(function onConnAccepted(ports) {
                ports.forEach((port) => {
                  port.postMessage(info);
                  port.onmessage = function(evt) {
                    systemCleaning = false;
                    updateDisplay(cleanApp);
                    console.log('evt '+ JSON.stringify(evt.data));
                  }
                });
              });
            }
          }
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    return SettingsPanel({
      onInit: function(panel) {
        this.once = true;
        _applist = document.getElementById('application-list');
        AppStorageListModule.init(_applist);
      },

      onBeforeShow: function() {
        var p1 = getSetting('icc.applications');
        var p2 = getSetting('airplaneMode.enabled');
        Promise.all([p1, p2]).then((values) => {
          var items = JSON.parse(values[0]);
          var stkEnabled = items && ('object' === typeof items) &&
            Object.keys(items).length;

          if (stkEnabled && (values[1] === false)) {
            AppStorageListModule._isSupportSTK = true;
          } else {
            AppStorageListModule._isSupportSTK = false;
          }
        });
        document.getElementById('application-data-ul').hidden = false;
        document.getElementById('application-list').hidden = true;
        if (!this.once) {
          AppStorageListModule.init(_applist);
        } else {
          this.once = false;
        }
        SettingsSoftkey.init(params);
        SettingsSoftkey.hide();
      },

      onHide: function() {
        var childs = _applist.childNodes;
        for(var i = childs.length - 1; i >= 0; i--) {
          _applist.removeChild(childs[i]);
        }
      },

      onBeforeHide: function() {
        var elements = document.querySelectorAll('#applicationStorage li');
        ListFocusHelper.removeEventListener(elements);
      }
    });
  };
});
