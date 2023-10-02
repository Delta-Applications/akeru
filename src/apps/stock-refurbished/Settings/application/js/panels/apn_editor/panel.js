/**
 * The apn editor panel
 */
define(['require','modules/settings_panel','panels/apn_editor/apn_editor','modules/settings_service','modules/apn/apn_settings_manager'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var ApnEditor = require('panels/apn_editor/apn_editor');
  var SettingsService = require('modules/settings_service');
  var ApnSettingsManager = require('modules/apn/apn_settings_manager');

  return function ctor_apnEditorPanel() {
    var _leftApp = false;
    var _apnItem;
    var _apnType;
    var _serviceId;
    var _apnEditor;
    var _editType;
    var _rootElement;
    var _editorSession;
    var _mandatoryItems;
    var _isDetail;//Defect858-tf-zhang@t2mobile.com-add
    var _inputs;
    var _valueSelectors;
    var _apnChanged = false;

    function _updateSoftKey(enableSaveSoftkey) {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: function() {
            _openWaringDialog();
          }
        }]
      };

      //Defect858-tf-zhang@t2mobile.com-modify-begin
      var softkeyParamsDetails = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Back',
          l10nId: 'back',
          priority: 3,
          method: function() {
            SettingsService.navigate('apn-list');
          }
        }]
      };

      if (enableSaveSoftkey) {
        softkeyParams.items.push({
          name: 'Save',
          l10nId: 'save',
          priority: 3,
          method: function() {
            _onApnSave();
          }
        });
      }

      SettingsSoftkey.init(_isDetail ? softkeyParamsDetails : softkeyParams);
      //Defect858-tf-zhang@t2mobile.com-modify-end
      SettingsSoftkey.show();
    }

    function _keyDownHandler(evt) {
      if ((evt.key === 'Backspace' ||
           evt.key === 'EndCall') &&
        Settings.currentPanel === '#apn-editor') {
        //Defect858-tf-zhang@t2mobile.com-modify-begin
        if(_isDetail){
          SettingsService.navigate('apn-list');
        }else{
          evt.preventDefault();
          _openWaringDialog(evt.key);
        }
        //Defect858-tf-zhang@t2mobile.com-modify-end
      }
    }

    function _checkMandatoryItems() {
      var apnName = _mandatoryItems.apnName.value;
      var apnType = _mandatoryItems.apnType.value;
      var apnCarrier = _mandatoryItems.apnCarrier.value;

      return (apnName !== '' && apnType !== '' && apnCarrier !== '');
    }

    function _back(softKeyName) {
      if (softKeyName === 'EndCall') {
        window.close();
      } else {
        _apnChanged = false;
        SettingsService.navigate('apn-list', {
          action: _editType
        });
      }
    }

    var _showApnChangeWarningDialog = () => {
      return new Promise(resolve => {
        var dialogConfig = {
          title: {id: 'confirmation', args: {}},
          body: {id: 'change-apn-warning-message', args: {}},
          desc: {id: 'change-apn-warning-question', args: {}},
          cancel: {
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            callback: function() {
              resolve(false);
            }
          },
          confirm: {
            name: 'Ok',
            l10nId: 'ok',
            priority: 3,
            callback: function() {
              resolve(true);
            }
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      });
    };

    function _onApnSave(softKeyName) {
      if (!_editorSession) {
        _back(softKeyName);
        return;
      }

      // Display the warning only when Data roaming is turned on and it is
      // the current APN in use that’s being edited.
      Promise.all([
        ApnSettingsManager.getActiveApnId(_serviceId, _apnType),
        new Promise(resolve => {
          SettingsDBCache.getSettings(results => {
            resolve(results['ril.data.roaming_enabled']);
          });
        })
      ]).then(results => {
        var activeApnId = results[0];
        var dataRoamingEnabled = results[1];
        if (activeApnId === _apnItem.id && dataRoamingEnabled) {
          return _showApnChangeWarningDialog();
        } else {
          return true;
        }
      }).then(result => {
        if (result) {
          _editorSession.commit().then(() => {
            _back(softKeyName);
            showToast('changessaved');
          });
          _editorSession = null;
        }
      });
    }

    function _openWaringDialog(softKeyName) {
      if (!_apnChanged) {
        _back(softKeyName);
        return;
      }
      var dialogConfig = {
        title: {id: 'confirmation', args: {}},
        body: {id: 'apn-editor-warning-body', args: {}},
        desc: {id: 'apn-editor-warning-desc', args: {}},
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Discard',
          l10nId: 'discard',
          priority: 3,
          callback: function() {
            _back(softKeyName);
          }
        }
      };

      if (_checkMandatoryItems()) {
        dialogConfig.accept = {
          name: 'Save',
          l10nId: 'save',
          priority: 2,
          callback: function() {
            _onApnSave(softKeyName);
          }
        };
      }

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _onItemInput() {
      _updateSoftKey(_checkMandatoryItems());
    }

    function _addTextInputEvent() {
      var item = null;
      for (item in _mandatoryItems) {
        _mandatoryItems[item].addEventListener('input', _onItemInput);
      }
    }

    function _removeTextInputEvent() {
      var item = null;
      for (item in _mandatoryItems) {
        _mandatoryItems[item].removeEventListener('input', _onItemInput);
      }
    }


    function _setCursorToEnd(el) {
      let range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      let sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      if (el.setSelectionRange) {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }

    function _onItemFocus(item) {
      var input = item.target.querySelector('input');
      input && input.focus();
      if ('INPUT' === document.activeElement.tagName) {
        _setCursorToEnd(document.activeElement);
      }
    }

    function _addInputFocusEvent() {
      var liElements = _rootElement.querySelectorAll('li');
      for (var i = 0; i < liElements.length; i++) {
        liElements[i].addEventListener('focus', _onItemFocus);
      }
    }

    function _removeInputFocusEvent() {
      var liElements = _rootElement.querySelectorAll('li');
      for (var i = 0; i < liElements.length; i++) {
        liElements[i].removeEventListener('focus', _onItemFocus);
      }
    }

    function _initUI(options) {
      // If this flag has been set, which means that users have been left
      // the app before so we should keep the original state instead of
      // refreshing it.
      if (_leftApp) {
        _leftApp = false;
        return;
      }

      var mode = options.mode || 'new';
      _apnItem = options.item || {};
      _apnType = options.type || 'default';
      _serviceId = options.serviceId;

      var enableSaveSoftkey = (mode === 'edit');
      _updateSoftKey(enableSaveSoftkey);

      switch (mode) {
        case 'new':
          var defaultApnItem = {
            apn: {
              types: [_apnType]
            }
          };
          _editType = 'new';
          _editorSession = _apnEditor.createApn(_serviceId, defaultApnItem);
          break;
        case 'edit':
          _editType = 'edit';
          _editorSession = _apnEditor.editApn(_serviceId, _apnItem);
          break;
      }
      //Defect858-tf-zhang@t2mobile.com-add-begin
      setUIDisabled();
    }

    function setDetails(apnItem){
      if(apnItem === undefined || apnItem == null){
        _isDetail = false;
      }else{
        //_isDetail = (apnItem['category'] == 'preset');
        if(apnItem._apn.read_only=="true"||apnItem._apn.read_only==true){
          _isDetail = true; 
        }else{
          _isDetail = false;
        }
      }
    }

    function setUIDisabled() {
      var inputElement = _rootElement.querySelectorAll('input');
      for(var a = 0; a < inputElement.length;a++){
        if(_isDetail){
          inputElement[a].setAttribute('disabled', 'disabled');
        }else if (inputElement[a] !== _rootElement.querySelector('input.types')){//Bug1128-lijuanli@t2mobile.com-disable APN Type input
          inputElement[a].removeAttribute('disabled');
        }
      }
      var selectElement = _rootElement.querySelectorAll('select');
      for(var b = 0; b < selectElement.length;b++){
        if(_isDetail){
          selectElement[b].setAttribute('disabled', 'disabled');
        }else{
          selectElement[b].removeAttribute('disabled');
        }
      }
    }
    //Defect858-tf-zhang@t2mobile.com-add-end


    function _ApnChange() {
      _apnChanged = true;
    }

    function _ObserveDMProtocol(protocol) {
      let hidden = true;
      let protocolLi =
        _rootElement.querySelector('li .apn-protocol-select').parentNode;
      let roamingProtocolLi =
        _rootElement.querySelector('li .apn-roaming-protocol').parentNode;
      if (!protocol) { // Is undefined/null/''
        hidden = false;
      }
      if (protocolLi.hidden !==  hidden) {
        protocolLi.hidden = hidden;
        roamingProtocolLi.hidden = hidden;
        NavigationMap.refresh();
      }
    }

    return SettingsPanel({
      onInit: function ae_onInit(rootElement, options) {
        _rootElement = rootElement;
        _mandatoryItems = {
          apnType: _rootElement.querySelector('input.types'),
          apnCarrier: _rootElement.querySelector('input.carrier'),
          apnName: _rootElement.querySelector('input.apn')
        };
        _apnEditor = new ApnEditor(rootElement);
        _inputs = document.querySelectorAll('#apn-editor input');
        _valueSelectors = document.querySelectorAll('#apn-editor select');
      },

      onBeforeShow: function ae_onBeforeShow(rootElement, options) {
        setDetails(options.item);//Defect858-tf-zhang@t2mobile.com-add
        _initUI(options);
        _addInputFocusEvent();
        window.addEventListener('keydown', _keyDownHandler);
        window.SettingsListener.observe('dm.apnSettings.protocol', '',
          _ObserveDMProtocol);
        for (let i = 0; i < _inputs.length; i++) {
          _inputs[i].addEventListener('input', _ApnChange);
        }
        for (let i = 0; i < _valueSelectors.length; i++) {
          _valueSelectors[i].addEventListener('change', _ApnChange);
        }
      },

      onbeforeHide: function ae_onBeforeHide() {
        _removeInputFocusEvent();
        window.removeEventListener('keydown', _keyDownHandler);
        window.SettingsListener.unobserve('dm.apnSettings.protocol',
          _ObserveDMProtocol);
        for (let i = 0; i < _inputs.length; i++) {
          _inputs[i].removeEventListener('input', _ApnChange);
        }
        for (let i = 0; i < _valueSelectors.length; i++) {
          _valueSelectors[i].removeEventListener('change', _ApnChange);
        }
      },

      onShow: function ae_onShow() {
        _addTextInputEvent();
      },

      onHide: function ae_onHide() {
        _removeTextInputEvent();
        _leftApp = document.hidden;
        if (!_leftApp && _editorSession) {
          _editorSession.cancel();
        }
      }
    });
  };
});
