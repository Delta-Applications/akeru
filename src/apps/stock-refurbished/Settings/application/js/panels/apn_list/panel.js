/**
 * The apn list panel
 */
define(['require','modules/mvvm/list_view','modules/settings_panel','modules/settings_service','modules/apn/apn_settings_manager','panels/apn_list/apn_template_factory'],function(require) {
  

  var ListView = require('modules/mvvm/list_view');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var ApnSettingsManager = require('modules/apn/apn_settings_manager');
  var ApnTemplateFactory = require('panels/apn_list/apn_template_factory');

  return function ctor_apn_settings_panel() {
    var _focusId = 0;
    itemsOBJ = {};
    var _serviceId = 0;
    var _apnType = 'default';
    var _rootElement;
    var _mainHeader;
    var _header;
    var _apnListViewRoot;
    var _apnListView;
    var _addApnBtn;
    var _role;
    var _softwareKeyRight; //right key
    var _listElements = [];
    var HEADER_L10N_MAP = {
      'default': 'dataSettings-header',
      'mms': 'messageSettings-header',
      'ims': 'imsSettings-header2',
      'supl': 'suplSettings-header',
      'dun': 'dunSettings-header'
    };

    var _returnTop = function() {
      SettingsService.navigate('apn-settings');
    };

    var _onApnItemEdit = function(focusItem) {
      SettingsService.navigate('apn-editor', {
        mode: 'edit',
        serviceId: _serviceId,
        type: _apnType,
        item: focusItem
      });
    };

    var _onApnItemDefaultSet = function(serviceId, apnType, radio, focusItem) {
      var setActive = function() {
        focusItem.active = true;
        radio.checked = true;
        ApnSettingsManager.setActiveApnId(serviceId, apnType, focusItem.id);
        showToast('changessaved');
      };

      SettingsDBCache.getSettings(function(results) {
        if (results['ril.data.roaming_enabled'] === true) {
          // Only display the warning when roaming is enabled.
          setActive();
        } else {
          // XXX: We need to make this to the next tick to the UI gets updated
          // because we've prevented the default behavior in the handler.
          setTimeout(function() {
            setActive();
          });
        }
      });
    };

    var _onApnAddAction = function(serviceId, apnType, rootElement) {
      _focusId = _getFocusPos(rootElement);
      SettingsService.navigate('apn-editor', {
        mode: 'new',
        serviceId: serviceId,
        type: apnType
      });
    };

    var _onBackBtnClick = function() {
      if (_role === 'activity') {
        _role = null;
        Settings.finishActivityRequest();
      } else {
        SettingsService.navigate('apn-settings');
      }
    };

    function _registerSoftkey() {
      let softkeyAdd = {
        name: 'Add Apn',
        l10nId: 'add-apn',
        priority: 1,
        method: () => {
          _onApnAddAction(_serviceId, _apnType, _rootElement);
        }
      };
      let softkeySelect = {
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: () => {
          if (!_rootElement.querySelector('.focus label')) {
            return;
          }
          let dataItemId = _rootElement.querySelector('.focus label').dataset.id;
          let radioElement = _rootElement.querySelector('.focus input');
          _onApnItemDefaultSet(_serviceId, _apnType, radioElement, itemsOBJ[dataItemId]);
          SettingsSoftkey.hide();
          _returnTop();
        }
      };
      let softkeyOption = [{
        name: 'Edit',
        l10nId: 'edit',
        priority: 7,
        method: () => {
          _focusId = _getFocusPos(_rootElement);
          let dataItemId = _rootElement.querySelector('.focus label').dataset.id;
          _onApnItemEdit(itemsOBJ[dataItemId]);
        }
      }, {
        name: 'Delete',
        l10nId: 'delete-apn',
        priority: 8,
        method: () => {
          let dataItemId = _rootElement.querySelector('.focus label').dataset.id;
          let focusItem = itemsOBJ[dataItemId];
          let dialogConfig = {
            title: { id: 'confirmation', args: {} },
            body: {
              id: 'delete-apn-confirm',
              args: {
                apnName: focusItem.apn.carrier
              }
            },
            cancel: {
              l10nId: 'cancel',
              priority: 1,
              callback: function() {},
            },
            confirm: {
              l10nId: 'delete-apn',
              priority: 3,
              callback: () => {
                if (focusItem.apn.deletedCpApn === false) {
                  focusItem.apn.deletedCpApn = true;
                  ApnSettingsManager.updateApn(_serviceId, focusItem.id,
                    focusItem.apn).then(() => {
                      _onApnDelete(_rootElement, focusItem.apn.carrier);
                    }).then(() => {
                      _updateUI();
                    }
                  );
                } else {
                  ApnSettingsManager.removeApn(_serviceId, focusItem.id).then(
                    () => {
                      _onApnDelete(_rootElement, focusItem.apn.carrier);
                    }).then(() => {
                      _updateUI();
                    }
                  );
                }
              }
            }
          }
          let dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
        }
      }];
      let softkeyParamsEmpty = {
        menuClassName: 'menu-button',
        header: { l10nId: 'message' },
        items: [{
          name: 'Add Apn',
          l10nId: 'add-apn',
          priority: 1,
          method: () => {
            _onApnAddAction(_serviceId, _apnType);
          }
        }]
      };
      let softkeyParams = {
        header: {l10nId: 'fxa-options'},
        items: []
      }
      let focusLabel = _rootElement.querySelector('.focus label');
      if (!focusLabel) {
        focusLabel = _rootElement.querySelector('li label');
      }
      softkeyParams.items.push(softkeyAdd);

      if (focusLabel) {
        softkeyParams.items.push(softkeySelect);
        let dataItemId = focusLabel.dataset.id;
        let focusItem = itemsOBJ[dataItemId];
        if (focusItem._category !== 'preset' ||
          focusItem._apn.carrier !== 'Jio 4G') {
          softkeyParams.items.push.apply(softkeyParams.items, softkeyOption);
        }
      }
      SettingsSoftkey.init(softkeyParams);
      customizeSoftRight();
    }

    function customizeSoftRight() {
      let _focusId = _getFocusPos(_rootElement);
      if (_focusId == null) {
        return;
      }

      let dataItemId = _rootElement.querySelector('.focus label').dataset.id;
      var theFocusElement = itemsOBJ[dataItemId];
       _softwareKeyRight = SettingsSoftkey.getSoftkey().getRightKey();
      var mind_=theFocusElement['apn']; 
      var  isOk=mind_['read_only']=='true'?true:false;
      console.log(`customizeSoftRight focus item readonly :${isOk}`);
      if(isOk){
        SettingsSoftkey.disRightKey();
        _softwareKeyRight.setAttribute('data-l10n-id', 'apn-details');//Defect3265-tf-zhang@t2mobile.com-add
      } else if(theFocusElement['category'] == 'custom'){
        // _softwareKeyRight.style.visibility='visible';
        SettingsSoftkey.enaRightKey();
        _softwareKeyRight.setAttribute('data-l10n-id', 'options');//Defect3265-tf-zhang@t2mobile.com-add
      }
    }

    function _updateSoftkey() {
      _registerSoftkey();
      SettingsSoftkey.show();
    }

    function _updateUI() {
      ApnSettingsManager.queryApns(_serviceId, _apnType).then(apnItems => {
        let find = false;
        Object.keys(apnItems).forEach(key => {
          if (apnItems[key].active) {
            let activeApnItem =
              _rootElement.querySelector('[data-id="' + apnItems[key].id + '"]');
            if (activeApnItem) {
              activeApnItem.querySelector('input').checked = true;
              let event = new CustomEvent('panelready', {
                detail: {
                  current: '#apn-list',
                  needFocused: activeApnItem.parentNode
                }
              });
              window.dispatchEvent(event);
              find = true;
            }
          }
        });
        if (!find) {
          let event = new CustomEvent('panelready', {
            detail: {
              current: '#apn-list'
            }
          });
          window.dispatchEvent(event);
        }
      });
    }

    function getElementByType(type, rootElement, focusId) {
      let liList = rootElement.querySelectorAll('li');
      let i = 0;
      if (type === 'edit') {
        for (; i < liList.length; i++) {
          if (i === focusId) {
            return liList[i];
          }
        }
      } else {
        for (; i < liList.length; i++) {
          let radio = liList[i].querySelector('input');
          if (radio.checked === true) {
            return liList[i];
          }
        }
      }
      return liList[0];
    }

    // after we deleted an apn , we should remove it from apn-list
    // and reset focus && navigation map && refresh softkeys
    function _onApnDelete(rootElement, apnName) {
      return new Promise(resolve => {
        let focusElement = rootElement.querySelector('li.focus');
        ListFocusHelper.removeEventListener(_listElements, _updateSoftkey);
        focusElement.parentNode.removeChild(focusElement);
        _listElements = document.querySelectorAll('.apn-list li');
        ListFocusHelper.addEventListener(_listElements, _updateSoftkey);
        _updateSoftkey();
        showToast('apn-deleted', {
          apnName: apnName
        });
        resolve();
      });
    }

    return SettingsPanel({
      onInit: function bp_onInit(rootElement) {
        var _self = this;
         _rootElement = rootElement;
        _mainHeader = rootElement.querySelector('gaia-header');
        _header = _mainHeader.querySelector('h1');
        _apnListViewRoot = rootElement.querySelector('.apn-list');
        _addApnBtn = rootElement.querySelector('button.add-apn');
        _mainHeader.addEventListener('action', _onBackBtnClick);
      },

      onBeforeShow: function bp_onBeforeShow(rootElement, options) {
        var _self = this;
        _role = options.role || _role;

        SettingsSoftkey.init(_self.softkeyParamsEmpty);
        SettingsSoftkey.show();
        if (options.type) {
          _focusId = 0;
        }
        // When back from apn editor, there is no type and serviceId specified
        // so that we use the original type and service id.
        _apnType = options.type || _apnType;
        _serviceId = (options.serviceId === undefined) ?
          _serviceId : options.serviceId;

        _header.setAttribute('data-l10n-id', HEADER_L10N_MAP[_apnType]);

        let apnTemplate =
          ApnTemplateFactory(_apnType, null, null);

        ApnSettingsManager.queryApns(_serviceId, _apnType)
          .then(apnItems => {
            _updateSoftkey();
            let filterapnItems = apnItems.filter((apnItem) => {
              return apnItem.apn.deletedCpApn !== true;
            });
            _apnListView = ListView(_apnListViewRoot, filterapnItems,
              apnTemplate);
            let needFocused =
              getElementByType(options.action, rootElement, _focusId);
            let event = new CustomEvent('panelready', {
              detail: {
                current: '#' + rootElement.id,
                previous: options.type ? '#apn-settings' : '#apn-editor',
                needFocused: needFocused
              }
            });
            window.dispatchEvent(event);
            _listElements = document.querySelectorAll('.apn-list li');
            ListFocusHelper.addEventListener(_listElements, _updateSoftkey);
            _updateSoftkey();
          });
      },

      onBeforeHide: function abp_onBeforeHide() {
        ListFocusHelper.removeEventListener(_listElements, _updateSoftkey);
      },

      onHide: function bp_onBeforeHide() {
        if (_apnListView) {
          _apnListView.destroy();
          _apnListView = null;
        }
      }
    });
  };
});
