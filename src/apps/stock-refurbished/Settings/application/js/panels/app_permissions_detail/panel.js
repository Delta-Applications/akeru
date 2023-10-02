
define('modules/navigator/mozApps',[],function() {
  
  return window.navigator.mozApps;
});

define('modules/navigator/mozPermissionSettings',[],function() {
  
  return window.navigator.mozPermissionSettings;
});

/**
 * Handle app_permissions_detail panel's functionality.
 */

define('panels/app_permissions_detail/app_permissions_detail',['require','shared/manifest_helper','modules/settings_service','modules/navigator/mozApps','modules/navigator/mozPermissionSettings'],function(require) {
  

  var ManifestHelper = require('shared/manifest_helper');
  var SettingsService = require('modules/settings_service');
  var mozApps = require('modules/navigator/mozApps');
  var mozPerms = require('modules/navigator/mozPermissionSettings');

  var PermissionsDetail = function pd() {
    this._elements = null;
    this._app = null;
    this.unistallDialogShow = false;
    this.appUnistalled = false;
    this.composedPermissions = null;
  };

  var composedPermTable = [
    'contacts',
    'device-storage:apps',
    'device-storage:pictures',
    'device-storage:videos',
    'device-storage:music',
    'device-storage:sdcard',
    'settings',
    'indexedDB-chrome-settings'
  ];

  PermissionsDetail.prototype = {
    /**
     * initialization
     */
    init: function pd_init(elements) {
      this._elements = elements;
      this.handleKeydown = this._handleKeydown.bind(this);
      // only go back to previous when application is uninstalled
      window.addEventListener('applicationuninstall', this.back);
    },

    /**
     * Back to app_permissions_list panel.
     */
    back: function pd_back() {
      if (this.appUnistalled === true) {
        this.appUnistalled = false;
        SettingsService.navigate('appPermissions');
      } else {
        if (this.unistallDialogShow === true) {
          this.unistallDialogShow = false;
        } else {
          SettingsService.navigate('appPermissions');
        }
      }
    },

    /**
     * Show app detail page.
     */
    showAppDetails: function pd_show_app_details(app, verbose) {
      this.show();
      this._isValidPerm = verbose ? this._isValidVerbosePerm : this._isExplicitPerm;
      this._app = app;
      var elements = this._elements;
      var manifest = new ManifestHelper(app.manifest ?
        app.manifest : app.updateManifest);

      elements.detailTitle.textContent = manifest.short_name || manifest.name;

      if (!mozPerms) {
        elements.list.hidden = true;
        return;
      } else {
        elements.list.hidden = false;
        elements.list.innerHTML = '';
      }

      if (manifest.permissions) {
        var composedPermissions = [];
        var display = null;
        for (var perm in manifest.permissions) {
          if (composedPermTable.indexOf(perm) !== -1) {
            var mode = manifest.permissions[perm].access;

            switch (mode) {
              case 'readonly' :
                composedPermissions.push(perm + '-' + 'read');
                break;
              case 'createonly' :
                composedPermissions.push(perm + '-' + 'create');
                break;
              case 'readcreate' :
                composedPermissions.push(perm + '-' + 'read');
                composedPermissions.push(perm + '-' + 'create');
                break;
              case 'readwrite' :
                composedPermissions.push(perm + '-' + 'read');
                composedPermissions.push(perm + '-' + 'create');
                composedPermissions.push(perm + '-' + 'write');
                break;
              default:
                break;
            }

            this.composedPermissions = composedPermissions;
            var value = null;
            display = composedPermissions.some((composedPerm) => {
              value = mozPerms.get(
                composedPerm, app.manifestURL, app.origin, false);
              if (this._isValidPerm(app, composedPerm, value)) {
                return true;
              }
              return false;
            });

            if (display) {
              this._insertPermissionSelect(perm, value);
            }
          } else {
            var value = mozPerms.get(perm, app.manifestURL, app.origin, false);
            if (perm !== 'desktop-notification' &&
              this._isValidPerm(app, perm, value)) {
              this._insertPermissionSelect(perm, value);
            }
          }
        }
      }
      elements.header.hidden = !elements.list.children.length;
      NavigationMap.refresh();
    },

    _isExplicitPerm: function pd_shouldDisplayPerm(app, perm, value) {
      var isExplicit = mozPerms.isExplicit(perm, app.manifestURL,
        app.origin, false);
      return (isExplicit && value !== 'unknown');
    },

    _isValidVerbosePerm: function pd_displayPermVerbose(app, perm, value) {
      if (app.manifest.type !== 'certified') {
        return (value !== 'unknown');
      } else {
        return this._isExplicitPerm(app, perm, value);
      }
    },

    /**
     * Detect event from user's selection of the permission.
     */
    selectValueChanged: function pd_select_value_changed(evt) {
      var select = evt.target;
      select.setAttribute('value', select.value);
      this._changePermission(select.dataset.perm, select.value);
      showToast('permission-changed');
    },

    killApp: function pd_kill_app() {
      navigator.mozApps.getSelf().onsuccess = (evt) => {
        var app = evt.target.result;
        var info = {};
        info.killAppOrigin = this._app.origin;
        app.connect('application-data-comms').then(function onAccepted(ports) {
          ports.forEach((port) => {
            port.postMessage(info);
            port.onmessage = function(evt) {
              console.log('evt '+ JSON.stringify(evt.data));
            }
          });
        });
      }
    },

    /**
     * Change permission of the app.
     */
    _changePermission: function pd__change_permission(perm, value) {
      if (!mozPerms) {
        return;
      }

      if (composedPermTable.indexOf(perm) !== -1) {
        this.composedPermissions.forEach((composedPerm) => {
          if (composedPerm.indexOf(perm) !== -1) {
            try {
              mozPerms.set(composedPerm, value, this._app.manifestURL,
                this._app.origin, false);
            } catch (e) {
              console.warn('Failed to set the ' + perm + 'permission.');
            }
          }
        });
      } else {
        try {
          mozPerms.set(perm, value, this._app.manifestURL,
            this._app.origin, false);
        } catch (e) {
          console.warn('Failed to set the ' + perm + 'permission.');
        }
      }
      this.killApp();
    },

    /**
     * Show available selection option of permission in app detail dialog.
     */
    _insertPermissionSelect: function pd__insert_permission_select(perm, value) {
      var item = document.createElement('li');
      var content = document.createElement('span');
      var contentL10nId = 'perm-' + perm.replace(':', '-');
      content.setAttribute('data-l10n-id', contentL10nId);
      content.classList.add(contentL10nId);

      var fakeSelect = document.createElement('span');
      fakeSelect.classList.add('button', 'icon', 'icon-dialog');

      var select = document.createElement('select');
      select.dataset.perm = perm;
      select.setAttribute('data-track-class', contentL10nId);

      var askOpt = document.createElement('option');
      askOpt.value = 'prompt';
      askOpt.setAttribute('data-l10n-id', 'ask');
      select.add(askOpt);

      var denyOpt = document.createElement('option');
      denyOpt.value = 'deny';
      denyOpt.setAttribute('data-l10n-id', 'deny');
      select.add(denyOpt);

      var allowOpt = document.createElement('option');
      allowOpt.value = 'allow';
      allowOpt.setAttribute('data-l10n-id', 'allow');
      select.add(allowOpt);

      var opt = select.querySelector('[value="' + value + '"]');
      opt.setAttribute('selected', true);

      select.onchange = this.selectValueChanged.bind(this);

      item.setAttribute('role', 'menuitem');
      item.onclick = function focusSelect() {
        select.focus();
      };

      fakeSelect.appendChild(select);
      item.appendChild(content);
      item.appendChild(fakeSelect);
      this._elements.list.appendChild(item);
    },

    /**
     * Handle keydown to make select get focus
     */
    _handleKeydown: function pd__handleKeydown(evt) {
      if (evt.key === 'Enter' || evt.key === 'Accept') {
        var select = document.querySelector('.current li.focus select');
        if (select !== null) {
          select.focus();
        }
      } else if (evt.key === 'BrowserBack' || evt.key == 'Backspace') {
        if (this.unistallDialogShow === true) {
          this.unistallDialogShow = false;
        } else {
          SettingsService.navigate('appPermissions');
        }
      }
    },

    /**
     * Remove keydown event listener
     */
    hide: function pd_hide() {
      window.removeEventListener('keydown', this.handleKeydown);
    },

    /**
     * Setup keydown event listener
     */
    show: function pd_show() {
      window.addEventListener('keydown', this.handleKeydown);
    },

    /**
     * Uninstall the choosed app.
     */
    uninstall: function pd_uninstall(callback) {
      this.unistallDialogShow = true;
      var appName = this._app.manifest.short_name || this._app.manifest.name;
      var req = mozApps.mgmt.uninstall(this._app);
      req.onsuccess = () => {
        if (typeof callback === 'function') {
          this.appUnistalled = true;
          callback({
            'appName': appName
          });
          this.back();
        }
      };
      req.onerror = () => {
        console.log("***app uninstalled failed***");
        this.back();
      };
    }
  };

  return function ctor_app_permissions_detail() {
    return new PermissionsDetail();
  };
});

define('panels/app_permissions_detail/panel',['require','shared/settings_listener','modules/settings_panel','panels/app_permissions_detail/app_permissions_detail','modules/apps_cache'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');
  var SettingsPanel = require('modules/settings_panel');
  var PermissionDetail =
    require('panels/app_permissions_detail/app_permissions_detail');
  var AppsCache = require('modules/apps_cache');

  return function ctor_app_permissions_detail_panel() {
    var elements = {};
    var permissionDetailModule = PermissionDetail();

    function showConfirmDialog(manifest) {
      var dialogConfig = {
        title: {id: 'uninstall', args: {}},
        body: {id: 'uninstall-app-body', args: {appName: manifest.name}},
        desc: {id: 'uninstall-app-body-2', args: {}},
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            dialog.destroy();
          },
        },
        confirm: {
          l10nId: 'uninstall',
          priority: 3,
          callback: function() {
            dialog.destroy();
            permissionDetailModule.uninstall(function (obj) {
              console.log("***app is uninstalled***");
              var _ = window.navigator.mozL10n.get;
              new Notification(
                _('uninstall-notification', { 'appName': obj.appName })
              ).close();
            });
          },
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function updateSKs(app) {
      if (!app.removable) {
        var params = {
          menuClassName: 'menu-button',
          header: { l10nId:'message' },
          items: [{
            name: 'Select',
            l10nId: 'select',
            priority: 2
          }]
        };
      } else {
        var manifest = new ManifestHelper(app.manifest ?
          app.manifest : app.updateManifest);
        var params = {
          menuClassName: 'menu-button',
          header: { l10nId:'message' },
          items: [
            {
              name: 'Select',
              l10nId: 'select',
              priority: 2
            },
            {
              name: 'Uninstall',
              l10nId: 'uninstall',
              priority: 3,
              method: function() {
                showConfirmDialog(manifest);
              }
            }]
        };
      }
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel, options) {
        this._verbose = null;
        this._panel = panel;
        elements = {
          list: panel.querySelector('.permissionsListHeader + ul'),
          header: panel.querySelector('.permissionsListHeader'),
          detailTitle: panel.querySelector('.detail-title')
        };
        SettingsListener.observe('debug.verbose_app_permissions', false,
          function(enabled) {
            this._verbose = enabled;
          }.bind(this));
        permissionDetailModule.init(elements);
      },

      onBeforeShow: function(panel, options) {
        let appChosen = new Promise(function(resolve, reject) {
          if (panel.dataset.caller) {
            AppsCache.apps().then((apps) => {
              return apps.find((app) =>
                app.manifest.name === panel.dataset.caller);
            }).then((app) => {
              if (!app) {
                reject();
              } else {
                resolve(app);
              }
            });
          } else if (options.app) {
            resolve(options.app);
          } else {
            reject();
          }
        }).then((appChosen) => {
          permissionDetailModule.showAppDetails(appChosen, this._verbose);
          var state = this._panel.classList.contains('current');
          if (state) {
            this._panel.querySelector('li').classList.add('focus');
          }
          updateSKs(appChosen);
        }, () => {
          console.error('can not find app!');
          permissionDetailModule.show();
        });
      },

      onBeforeHide: function() {
        permissionDetailModule.hide();
      }
    });
  };
});
