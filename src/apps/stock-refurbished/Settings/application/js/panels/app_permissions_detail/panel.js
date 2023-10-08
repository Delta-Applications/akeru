define('modules/navigator/mozApps', [], function () {

  return window.navigator.mozApps;
});

define('modules/navigator/mozPermissionSettings', [], function () {

  return window.navigator.mozPermissionSettings;
});

/**
 * Handle app_permissions_detail panel's functionality.
 */

define('panels/app_permissions_detail/app_permissions_detail', ['require', 'shared/manifest_helper', 'modules/settings_service', 'modules/navigator/mozApps', 'modules/navigator/mozPermissionSettings'], function (require) {


  var ManifestHelper = require('shared/manifest_helper');
  var SettingsService = require('modules/settings_service');
  var mozApps = require('modules/navigator/mozApps');
  var mozPerms = require('modules/navigator/mozPermissionSettings');

  var PermissionsDetail = function pd() {
    this._elements = null;
    this._app = null;
    this.uninstallDialogShow = false;
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
        if (this.uninstallDialogShow === true) {
          this.uninstallDialogShow = false;
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

      console.log(manifest)

      elements.icon.src = this._getBestIconURL(app, manifest.icons);
      elements.name.innerText = manifest.name || manifest.short_name;
      elements.subtitle.innerText = manifest.version + (manifest.developer !== null && manifest.developer.name !== null ? " · " + manifest.developer.name : "");
      console.log(manifest.developer)
      elements.detailTitle.style.display = "none"//textContent = manifest.short_name || manifest.name;
      /* elements.desc.textContent = manifest.description;*/

      /*if (!mozPerms) {
        elements.list.hidden = true;
        return;
      } else {
        elements.list.hidden = false;
        elements.menu.querySelectorAll('[_deleteref="true"]').forEach(element => {
          element.remove();
        });
        //elements.list.innerHTML = ``;
      }*/

      elements.menu.querySelectorAll('[_deleteref="true"]').forEach(element => {
        element.remove();
      });

      if (manifest.permissions) {
        var composedPermissions = [];
        var display = null;
        for (var perm in manifest.permissions) {
          if (composedPermTable.indexOf(perm) !== -1) {
            var mode = manifest.permissions[perm].access;

            switch (mode) {
              case 'readonly':
                composedPermissions.push(perm + '-' + 'read');
                break;
              case 'createonly':
                composedPermissions.push(perm + '-' + 'create');
                break;
              case 'readcreate':
                composedPermissions.push(perm + '-' + 'read');
                composedPermissions.push(perm + '-' + 'create');
                break;
              case 'readwrite':
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
            port.onmessage = function (evt) {
              console.log('evt ' + JSON.stringify(evt.data));
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
      item.setAttribute('_deleteref', "true")
      item.onclick = function focusSelect() {
        select.focus();
      };

      fakeSelect.appendChild(select);
      item.appendChild(content);
      item.appendChild(fakeSelect);
      this._elements.menu.appendChild(item);
      this._elements.list.after(item);
    },

    showConfirmDialog: function showConfirmDialog(manifest) {
    var dialogConfig = {
      title: {
        id: 'uninstall',
        args: {}
      },
      body: {
        id: 'uninstall-app-body',
        args: {
          appName: manifest.name
        }
      },
      desc: {
        id: 'uninstall-app-body-2',
        args: {}
      },
      cancel: {
        l10nId: 'cancel',
        priority: 1,
        callback: function () {
          dialog.destroy();
        },
      },
      confirm: {
        l10nId: 'uninstall',
        priority: 3,
        callback: function () {
          dialog.destroy();
          permissionDetailModule.uninstall(function (obj) {
            console.log("***app is uninstalled***");
            var _ = window.navigator.mozL10n.get;
            new Notification(
              _('uninstall-notification', {
                'appName': obj.appName
              })
            ).close();
          });
        },
      },
    };
    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('app-confirmation-dialog'));
  },
  showAppDesc: function showConfirmDialog(manifest) {
    var dialogConfig = {
      title: {
        text: manifest.name,
        args: {}
      },
      body: {
        text: manifest.description,
        args: {}
      },
     /* desc: {
        id: 'uninstall-app-body-2',
        args: {}
      },*/
      cancel: {
        l10nId: 'cancel',
        priority: 1,
        callback: function () {
          dialog.destroy();
        },
      },
      /*confirm: {
        l10nId: 'open',
        priority: 3,
        callback: function () {
          dialog.destroy();
        
        },
      },*/
    };
    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('app-confirmation-dialog'));
  },

  updateSKs: function updateSKs(app, isbadgeselected) {
    var manifest = new ManifestHelper(app.manifest ?
      app.manifest : app.updateManifest);
    var params = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [isbadgeselected ? {
          name: 'Close',
          l10nId: 'close',
          priority: 1,
          method: function () {
            // Add user confirmation is app has system role or is hidden
          }
        } : { name: '', l10nId: '', priority: 1, method: function () {}},
        {
          name: isbadgeselected ? '' : 'Select',
          l10nId: isbadgeselected ? '' : 'select',
          priority: 2
        },
        isbadgeselected ? {
          name: 'Uninstall',
          l10nId: 'uninstall',
          priority: 3,
          method: function () {
          }
        } : { name: '', l10nId: '', priority: 3, method: function () {}}
      ]
    };
  SettingsSoftkey.init(params);
  SettingsSoftkey.show();
},
    /**
     * Handle keydown to make select get focus
     */
    _handleKeydown: function pd__handleKeydown(evt) {
      var select = document.querySelector('.current li.focus');
      console.log("check")
      if (select !== null) this.updateSKs(this._app, select.id == "app-badge");

      console.log(select !== null, select.id === "app-badge", this._app.manifest, evt.key)

      if (select !== null && select.id === "app-badge") {
        console.log("checkee")
          if (evt.key === "SoftRight") this.showConfirmDialog(this._app.manifest);
          if (evt.key === "SoftLeft") this.killApp();
          if (evt.key === "Enter") this.showAppDesc(this._app.manifest);
      }

      if (evt.key === 'Enter' || evt.key === 'Accept') {
        if (select !== null) {
          console.log(select)
          select.focus();
        }
      } else if (evt.key === 'BrowserBack' || evt.key == 'Backspace') {
        if (this.uninstallDialogShow === true) {
          this.uninstallDialogShow = false;
        } else {
          SettingsService.navigate('appPermissions');
        }
      }
    },

    _getBestIconURL: function pl__getBestIconURL(app, icons) {
      if (!icons || !Object.keys(icons).length) {
        return '../style/images/default.png';
      }

      // The preferred size is 30 by the default. If we use HDPI device, we may
      // use the image larger than 30 * 1.5 = 45 pixels.
      var preferredIconSize = 30 * (window.devicePixelRatio || 1);
      var preferredSize = Number.MAX_VALUE;
      var max = 0;

      for (var size in icons) {
        size = parseInt(size, 10);
        if (size > max) {
          max = size;
        }

        if (size >= preferredIconSize && size < preferredSize) {
          preferredSize = size;
        }
      }
      // If there is an icon matching the preferred size, we return the result,
      // if there isn't, we will return the maximum available size.
      if (preferredSize === Number.MAX_VALUE) {
        preferredSize = max;
      }

      var url = icons[preferredSize];

      if (url) {
        return !(/^(http|https|data):/.test(url)) ? app.origin + url : url;
      } else {
        return '../style/images/default.png';
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
      this.uninstallDialogShow = true;
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

define('panels/app_permissions_detail/panel', ['require', 'shared/settings_listener', 'modules/settings_panel', 'panels/app_permissions_detail/app_permissions_detail', 'modules/apps_cache'], function (require) {


  var SettingsListener = require('shared/settings_listener');
  var SettingsPanel = require('modules/settings_panel');
  var PermissionDetail =
    require('panels/app_permissions_detail/app_permissions_detail');
  var AppsCache = require('modules/apps_cache');

  return function ctor_app_permissions_detail_panel() {
    var elements = {};
    var permissionDetailModule = PermissionDetail();

    return SettingsPanel({
      onInit: function (panel, options) {
        this._verbose = null;
        this._panel = panel;
        elements = {
          list: panel.querySelector('#appdetails-list'),
          header: panel.querySelector('.permissionsListHeader'),
          detailTitle: panel.querySelector('[data-href="appPermissions"]'),
          name: panel.querySelector('#app-name'),
          subtitle: panel.querySelector('#app-subtitle'),
          icon: panel.querySelector('#app-icon'),
          desc: panel.querySelector('#app-desc'),
          menu: panel.querySelector('#appdetails-menu')
        };
        SettingsListener.observe('debug.verbose_app_permissions', false,
          function (enabled) {
            this._verbose = enabled;
          }.bind(this));
        permissionDetailModule.init(elements);
      },

      onBeforeShow: function (panel, options) {
        let appChosen = new Promise(function (resolve, reject) {
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
          //updateSKs(appChosen);
        }, () => {
          console.error('can not find app!');
          permissionDetailModule.show();
        });
      },

      onBeforeHide: function () {
        permissionDetailModule.hide();
      }
    });
  };
});