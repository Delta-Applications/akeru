
/**
 * Handle HardwareInfo related functionality
 *
 * @module about/HardwareInfo
 */
define('panels/about/hardware_info',['require'],function(require) {
  

  /**
   * @alias module:about/HardwareInfo
   * @class HardwareInfo
   * @returns {HardwareInfo}
   */
  var HardwareInfo = function() {
    this._elements = null;
  };

  HardwareInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf HardwareInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function hi_init(elements) {
      this._elements = elements;

      this._loadHardwareInfo();
    },

    /**
     * Load hardware related informations.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     */
    _loadHardwareInfo: function hi__loadHardwareInfo() {
      let _conns = navigator.mozMobileConnections;
      let noSimCard = true;
      Array.prototype.forEach.call(_conns, (conn) => {
        if (conn.iccId) {
          noSimCard = false;
        }
      });
      if (noSimCard) {
        this._elements.deviceInfoPhoneNum.hidden = true;
        return;
      }

      let _isMultiSim = _conns.length > 1;
      // Only show the list item when there are valid iccinfos.
      let _hideListItem = true;

      // update msisdns
      while (this._elements.deviceInfoMsisdns.hasChildNodes()) {
        this._elements.deviceInfoMsisdns.removeChild(
          this._elements.deviceInfoMsisdns.lastChild);
      }

      Array.prototype.forEach.call(_conns, function(conn, index) {
        let iccId = conn.iccId;
        let iccObj;
        let iccInfo;

        if (!iccId && !_isMultiSim){
          return;
        }

        if (iccId) {
          iccObj = navigator.mozIccManager.getIccById(iccId);
        }

        if (iccObj) {
          iccInfo = iccObj.iccInfo;
        }

        _hideListItem = false;
        let span = this._renderPhoneNumberElement(iccInfo, index, _isMultiSim);
        this._elements.deviceInfoMsisdns.appendChild(span);
      }.bind(this));

      this._elements.deviceInfoPhoneNum.hidden = _hideListItem;
    },

    /**
     * render phone number element based on SIM card info.
     *
     * If the icc card is gsm card, the phone number is in msisdn.
     * Otherwise, the phone number is in mdn.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     * @param {Object} iccInfo iccInfo data
     * @param {Number} index index number
     * @param {Boolean} isMultiSim has multiple SIM
     * @return {HTMLElement} span element with number info
     */
    _renderPhoneNumberElement: function hi__renderPhoneNumberElement(
      iccInfo, index, isMultiSim) {
        var span = document.createElement('span');
        var msisdn;

        if (iccInfo) {
          msisdn = iccInfo.msisdn || iccInfo.mdn;
        }

        if (msisdn) {
          if (isMultiSim) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-MSISDN-with-index', {
                index: index + 1,
                msisdn: msisdn
            });
          } else {
            span.textContent = msisdn;
          }
        } else if (iccInfo && iccInfo.iccid) {
          if (isMultiSim) {
            navigator.mozL10n.setAttributes(span,
              'unknown-phoneNumber-sim', { index: index + 1 });
          } else {
            span.setAttribute('data-l10n-id', 'unknown-phoneNumber');
          }
        } else {
          if (isMultiSim) {
            navigator.mozL10n.setAttributes(span,
              'noSim-with-index-and-colon', { index: index + 1 });
          } else {
            span.setAttribute('data-l10n-id', 'noSimCard');
          }
        }
        return span;
    }
  };

  return function ctor_hardwareInfo() {
    return new HardwareInfo();
  };
});

/**
 * Handle Update check related functionality
 *
 * @module about/UpdateCheck
 */
define('panels/about/update_check',['require'],function(require) {
  

  /**
   * @alias module:about/UpdateCheck
   * @class UpdateCheck
   * @returns {UpdateCheck}
   */
  var UpdateCheck = function() {
    this._elements = null;
    this._settings = window.navigator.mozSettings;
    this._checkStatus = {
      'gecko.updateStatus': {},
      'apps.updateStatus': {}
    };
  };

  UpdateCheck.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf UpdateCheck.prototype
     * @param {HTMLElement} elements
     */
    init: function uc_init(elements) {
      this._elements = elements;

      this._loadLastUpdated();

      this._elements.checkUpdateNow.addEventListener('click',
        this._checkForUpdates.bind(this));
    },

    /**
     * Show last update date.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _loadLastUpdated: function uc__loadLastUpdated() {
      var key = 'deviceinfo.last_updated';
      var request = this._settings.createLock().get(key);

      request.onsuccess = function() {
        var lastUpdated = request.result[key];
        if (!lastUpdated) {
          return;
        }

        var d = new Date(lastUpdated);
        this._elements.lastUpdateDate.textContent =
          d.toLocaleString(navigator.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric' });
      }.bind(this);
    },

    /**
     * update result based on return states
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _statusCompleteUpdater: function uc__statusCompleteUpdater() {
      var hasAllCheckComplete =
        Object.keys(this._checkStatus).some((setting) =>
          this._checkStatus[setting].value === 'check-complete'
        );

      var hasAllResponses =
        Object.keys(this._checkStatus).every((setting) =>
          !!this._checkStatus[setting].value
        );

      if (hasAllCheckComplete) {
        this._elements.updateStatus.classList.remove('visible');
        this._elements.systemStatus.textContent = '';
      }

      // On no-updates we should also remove the checking class.
      var hasNoUpdatesResult =
        Object.keys(this._checkStatus).some((setting) =>
          this._checkStatus[setting].value === 'no-updates'
        );

      if (hasAllResponses || hasNoUpdatesResult) {
        this._elements.updateStatus.classList.remove('checking');
      }
    },

    /**
     * handler for update status.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     * @param  {String} setting gecko or app setting
     * @param  {Object} event   event contains SettingValue
     */
    _onUpdateStatus: function uc__onUpdateStatus(setting, event) {
      var value = event.settingValue;
      this._checkStatus[setting].value = value;

      /**
       * possible return values:
       *
       * - for system updates:
       *   - no-updates
       *   - already-latest-version
       *   - check-complete
       *   - retry-when-online
       *   - check-error-$nsresult
       *   - check-error-http-$code
       *
       * - for apps updates:
       *   - check-complete
       *
       * use
       * http://mxr.mozilla.org/mozilla-central/ident?i=setUpdateStatus&tree=mozilla-central&filter=&strict=1
       * to check if this is still current
       */

      var l10nValues = [
        'no-updates', 'already-latest-version', 'retry-when-online'];

      if (value !== 'check-complete') {
        var id = l10nValues.indexOf(value) !== -1 ? value : 'check-error';
        this._elements.systemStatus.setAttribute('data-l10n-id', id);
        if (id === 'check-error') {
          console.error('Error checking for system update:', value);
        }
      }

      this._statusCompleteUpdater();

      this._settings.removeObserver(setting, this._checkStatus[setting].cb);
      this._checkStatus[setting].cb = null;
    },
    _changeUpdateFocus: function uc__changeUpdateFocus(){
      var focusedElement = document.querySelector("#about .focus");
      console.log("_checkForUpDate------focusedElement=",focusedElement);
      focusedElement.hidden = true;
      focusedElement.classList.remove('focus');

      var nvId = focusedElement.getAttribute('data-nav-id');
      
      this._elements.updateStatus.setAttribute('data-nav-id', nvId);
      this._elements.updateStatus.style.setProperty('--nav-left', nvId);
      this._elements.updateStatus.style.setProperty('--nav-right', nvId);
      this._elements.updateStatus.style.setProperty('--nav-down', ++nvId);
      this._elements.updateStatus.style.setProperty('--nav-up', nvId-2);
      this._elements.updateStatus.setAttribute('tabindex', 0);
      this._elements.updateStatus.classList.add('focus');
      this._elements.updateStatus.hidden = false;
      focusedElement.removeAttribute('data-nav-id');
    },
    /**
     * Check if there's any update.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _checkForUpdates: function uc__checkForUpdates() {
      if (!navigator.onLine) {
       var dialogConfig = {
          title: {id: 'settings', args: {}},
          body: {id: "no-network-when-update", args: {}},
          accept: {
            l10nId:'ok',
            priority:2,
            callback: function(){
              dialog.destroy();
            },
          },
        };
        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
        return;
      }

      this._elements.updateStatus.classList.add('checking', 'visible');
      this._changeUpdateFocus();
      /* remove whatever was there before */
      this._elements.systemStatus.textContent = '';

      for (var setting in this._checkStatus) {
        this._checkStatus[setting].cb =
          this._onUpdateStatus.bind(this, setting);
        this._settings.addObserver(setting, this._checkStatus[setting].cb);
      }

      this._settings.createLock().set({
        'gaia.system.checkForUpdates': true
      });
    }
  };

  return function ctor_updateCheck() {
    return new UpdateCheck();
  };
});

/**
 * Used to show Device/Information panel
 */
/* global SettingsSoftkey, ConfirmDialogHelper, FxAccountsIACHelper,
   LazyLoader */

define('panels/about/panel',['require','modules/settings_panel','panels/about/hardware_info','panels/about/update_check','shared/settings_listener','modules/settings_service','shared/simslot_manager'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var HardwareInfo = require('panels/about/hardware_info');
  var UpdateCheck = require('panels/about/update_check');
  var SettingsListener = require('shared/settings_listener');
  var SettingsService = require('modules/settings_service');
  var SIMSlotManager = require('shared/simslot_manager');

  return function ctor_support_panel() {
    var hardwareInfo = HardwareInfo();
    var updateCheck = UpdateCheck();
    var elements = {};
    var fotaSettings = null;
    var softkeyParams = {
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
    const LOW_BATTERY_LEVEL = 0.25;
    let link = 'https://support.kaiostech.com/en/support/tickets/new';
    let token = null;
    let fotaName = 'kaios';

    function _signOutAndReset() {
      if (!navigator.mozId) {
        _checkFactoryReset();
        return;
      }
      FxAccountsIACHelper.getAccounts(function onGetAccounts(accts) {
        if (!accts) {
          _checkFactoryReset();
          return;
        }

        if (!navigator.onLine) {
          showToast('disable-antitheft-network-error');
          return;
        }
        var account = _getValidAccount(accts);
        FxAccountsIACHelper.checkPassword(account, 'ResetFactory',
          function (data) {
          if ((data && data.result === 'success') ||
            (data && data.error && data.error === 'ACCOUNT_DELETED')) {
            _checkFactoryReset();
          }
        }, function () { });
      }, function () { });
    }


    function _initSoftKey() {
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function _updateSoftKey(evt) {
      var position = evt.target.classList.contains('none-select');
      if (!position) {
        _initSoftKey();
      } else {
        SettingsSoftkey.hide();
      }
    }

    function _initAllEventListener() {
      elements.feedBackButton.addEventListener('keydown', _showFeedBackDialog);
      elements.resetButton.addEventListener('keydown', _showRestDialog);
      var i = elements.items.length - 1;
      for (i; i >= 0; i--) {
        elements.items[i].addEventListener('focus', _updateSoftKey);
      }
    }

    function _removeAllEventListener() {
      elements.feedBackButton.removeEventListener('keydown', _showFeedBackDialog);
      elements.resetButton.removeEventListener('keydown', _showRestDialog);
      var i = elements.items.length - 1;
      for (i; i >= 0; i--) {
        elements.items[i].removeEventListener('focus', _updateSoftKey);
      }
    }
    function _checkFactoryReset() {
      if (navigator.battery.level < LOW_BATTERY_LEVEL) {
        var dialogConfig = {
          title: {},
          body: { id: 'battery-warning-body', args: {} },
          accept: {
            name: 'Ok',
            l10nId: 'ok',
            priority: 2,
            callback: function() {}
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      } else {
        _checkScreenLock();
      }
    }

    function _checkScreenLock() {
      getSetting('lockscreen.passcode-lock.enabled').then((enabled) => {
        if (enabled) {
          SettingsService.navigate('screenLock-passcode', {
            mode: 'confirm',
            origin: '#about'
          });
        } else {
          SettingsService.navigate('reset-phone-progress');
        }
      });
    }

    function _showFeedBackDialog(evt) {
      if (evt.key === 'Enter') {
        evt.stopPropagation();
        evt.preventDefault();
        let request = navigator.mozSettings.createLock().get('*');
        var dialogConfig = {
          title: {id: 'feedback-dialogview-header', args: {}},
          body: {id: 'feedback-dialogview-1', args: {}},
          desc: {id: 'feedback-dialogview-2', args: {}},
          cancel: {
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            callback: function() {}
          },
          accept: {
            name: 'OK',
            l10nId: 'ok',
            callback: function() {
              if (SIMSlotManager.noSIMCardOnDevice()) {
                var toast = {
                  messageL10nId: 'insert-sim',
                  latency: 2000,
                  useTransition: true
                };
                Toaster.showToast(toast);
                return;
              }

              var wifiManager = window.navigator.mozWifiManager;
              console.log("[JWJ] SIM card is inserted, check WIFI now");
              Promise.race([request]).then(value => {
                var wifiAvailable = value['wifi.enabled'] && wifiManager && wifiManager.connection.status === 'connected';
                if (!wifiAvailable && !value['ril.data.enabled']) {

                  var toast = {
                    messageL10nId: 'feedback-errormessage-data-wifi-off',
                    latency: 2000,
                    useTransition: true
                  };
                  Toaster.showToast(toast);
                  return;
                }
                if(!wifiAvailable ) {
                   var fdnEnabled = getIccByIndex(value['ril.data.defaultServiceId']).getCardLock('fdn');
                  fdnEnabled.onsuccess = function() {
                    var enabled = fdnEnabled.result.enabled;
                    if(enabled){
                      _showFDNDialog();
                      return;
                    }
                    console.log("[JWJ]  WIFI is not avaialable");
                    SettingsService.navigate('about-feedback');
                  };
                }else{
                  console.log("[JWJ]  WIFI is avaialable, open about-feedback");
                  SettingsService.navigate('about-feedback');
                }
              });
            }
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      }
    }

    function _showFDNDialog() {
      var dialogConfig = {
       title: { id: 'feedback-dialogview-header', args: {} },
        body: { id: 'feedback-dialogview-fdn', args: {} },
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        accept: {
          name: 'OK',
          l10nId: 'ok',
          callback: function() {
            SettingsService.navigate('call-fdnSettings');
          }
        }
      }
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _showRestDialog(evt) {
      if (evt.key === 'Enter') {
        var dialogConfig = {
          title: {id: 'reset-warning-title', args: {}},
          body: {id: 'reset-warning-body-1', args: {}},
          cancel: {
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            callback: function() {}
          },
          confirm: {
            name: 'Reset',
            l10nId: 'reset',
            priority: 3,
            callback: function() {
              _signOutAndReset();
            }
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      }
    }

    function _updateAboutLegalInfoItem(enabled) {
      elements.aboutLegalInfoItem.hidden = !enabled;
      NavigationMap.refresh();
    }

    function _fotaKeydownHandler(evt) {

      if (evt.key === 'Enter') {
        if ('redbend' === fotaName && navigator.OmaService) {
          navigator.OmaService.command('check:ui', 'settings');
          return;
        }
        var activity = new MozActivity({
          name: 'launch-fota',
          data: { param: 'startFromSettings' }
        });
      }
    }

    function getSetting(settingKey) {
      return new Promise(function (resolve, reject) {
        navigator.mozSettings.createLock().get(settingKey).then(
          (result) => {
            resolve(result[settingKey]);
          });
      });
    }

    function checkCustomerSupport() {
      let p1 = getSetting('customer.support.enabled');
      let p2 = getSetting('language.current');
      Promise.all([p1, p2]).then(function(values) {
        let customerSupport = values[0];
        let currentLanguage = values[1];
        if (customerSupport &&
          (currentLanguage === 'en-US' ||
          currentLanguage === 'en-GB' ||
          currentLanguage === 'en-NG') &&
          token) {
          elements.customerSupport.hidden = false;
        } else {
          elements.customerSupport.hidden = true;
        }
        NavigationMap.refresh();
      });
    }

    function keyDownHandler(evt) {
      switch (evt.key) {
        case 'Enter':
          window.open(link, 'popup');
        default:
          break;
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          items: panel.querySelectorAll('li'),
          resetButton: panel.querySelector('.reset-phone'),
          feedBackButton: panel.querySelector('.feed-back'),
          aboutLegalInfoItem: panel.querySelector('.about-legal-info'),
          customerSupport: panel.querySelector('.customer-support')
        };
        fotaSettings = panel.querySelector('#fota-settings');
        let req =
          navigator.mozSettings.createLock().get('deviceinfo.product_fota');
        req.onsuccess = function() {
          fotaName = req.result['deviceinfo.product_fota'];
          fotaSettings.hidden =
            !( ('redbend' === fotaName && navigator.OmaService)
               || navigator.fota );
        };
        req.onerror = function() {
          fotaSettings.hidden = !navigator.fota;
        };

        var tostCount = 0;
        SettingsListener.observe('app.update.interval', false, value => {
          tostCount++;
          if(tostCount > 1){
            showToast('changessaved');
           }
        });

        updateCheck.init({
          checkUpdateNow: panel.querySelector('.check-update-now'),
          lastUpdateDate: panel.querySelector('.last-update-date'),
          updateStatus: panel.querySelector('.update-status'),
          systemStatus: panel.querySelector('.system-update-status')
        });

        if (navigator.mozId) {
          navigator.mozId.watch({
            wantIssuer: 'kaios-accounts',
            onlogin: (assertion) => {
              assertionObj = JSON.parse(assertion);
              if (!assertionObj) {
                return;
              }
              token = {
                kid: assertionObj.kid,
                macKey: assertionObj.mac_key
              };
            },
            onlogout: () => {
              token = null;
            },
            onready: () => {
            },
            onerror: (error) => {
              console.error('kaios account error: '+error);
            }
          });
        }
      },

      onBeforeShow: function(panel, options) {
        hardwareInfo.init({
          deviceInfoPhoneNum: panel.querySelector('.deviceinfo-phone-num'),
          deviceInfoMsisdns: panel.querySelector('.deviceInfo-msisdns')
        });
        if (options.origin === '#screenLock-passcode') {
          getSetting('lockscreen.passcode-lock.enabled').then((enabled) => {
            if (!enabled) {
              SettingsService.navigate('reset-phone-progress');
            }
          });
        }
        checkCustomerSupport();
        SettingsSoftkey.init(softkeyParams);
        ListFocusHelper.updateSoftkey(panel);
        SettingsListener.observe('about.legal.info.enabled', true,
          _updateAboutLegalInfoItem);
        ListFocusHelper.addEventListener(elements.items);
        //JWJ: move to initAllEventListener
        //elements.resetButton.addEventListener('keydown', _showRestDialog);
        _initSoftKey();
        _initAllEventListener();
        fotaSettings.addEventListener('keydown', _fotaKeydownHandler);
        elements.customerSupport.addEventListener('keydown', keyDownHandler);
      },

      onBeforeHide: function() {
        SettingsListener.unobserve('about.legal.info.enabled',
          _updateAboutLegalInfoItem);
        ListFocusHelper.removeEventListener(elements.items);
        //JWJ: move to removeAllEventListener
        //elements.resetButton.removeEventListener('keydown', _showRestDialog);
        _removeAllEventListener();
        fotaSettings.removeEventListener('keydown', _fotaKeydownHandler);
        elements.customerSupport.removeEventListener('keydown',
          keyDownHandler);
      },

      onShow: function() {
      },

    });
  };
});
