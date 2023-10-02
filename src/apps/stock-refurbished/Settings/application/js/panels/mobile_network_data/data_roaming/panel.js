/* set data roaming*/
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

    // BDC wangzhigang porting arg data roaming menu to bts. begin
    // Indicate current customization value
    var dataRoamingCustomized = false;
    // BDC wangzhigang porting arg data roaming menu to bts. end

//Bug fixing BTS-944 --Start
//JWJ:If this function is undefined, the initUI will fail to set the current value for data roaming
  function log(msg) {
    console.log('[data_roaming_panel] ' + msg);
  };
//Bug fixing BTS-944 --End

  return function data_roaming_panel() {
    let currentSettingsValue = false;
    let switchOn = null;
    let switchOff = null;
    return SettingsPanel({
      onInit: function (panel) {
        // BDC wangzhigang porting arg data roaming menu to bts. begin
        var onInitPoint = this;
        // BDC wangzhigang porting arg data roaming menu to bts. end
        this.elements = {
          // BDC wangzhigang porting arg data roaming menu to bts. begin
          dataRoamingKey:'ril.data.roaming_enabled',
          // BDC wangzhigang porting arg data roaming menu to bts. end
          panel: panel,
          params : {
            menuClassName: 'menu-button',
            header: { l10nId:'message' },
            items: [{
              name: 'Cancel',
              l10nId: 'cancel',
              priority: 1,
              method: function() {
                NavigationMap.navigateBack();
              }
            }, {
              name: 'Select',
              l10nId: 'select',
              priority: 2,
              // BDC wangzhigang porting arg data roaming menu to bts. begin
/*
              method: function() {}
*/
              method: function() {
                onInitPoint.onDataRoamingSet();
              }
              // BDC wangzhigang porting arg data roaming menu to bts. end
            }]
          },
        };
        this.initUI();
      },

      // BDC wangzhigang porting arg data roaming menu to bts. begin
      //switch data roaming
      onDataRoamingSet: function(){
        if(!_self.elements.panel.querySelector('.focus input[name="data_roaming_switch"]')) {
          return;
        }
        var set = {};
        // BDC wangzhigang porting arg data roaming menu to bts. begin
        // Set current data roaming key according to current customization value
        set[_self.elements.dataRoamingKey] = dataRoamingCustomized
            ? parseInt(_self.elements.panel.querySelector('.focus input[name="data_roaming_switch"]').value)
            : Boolean(parseInt(_self.elements.panel.querySelector('.focus input[name="data_roaming_switch"]').value));
        //set[_self.elements.dataRoamingKey] = Boolean(parseInt(_self.elements.panel.querySelector('.focus input[name="data_roaming_switch"]').value));
        // BDC wangzhigang porting arg data roaming menu to bts. end
        window.navigator.mozSettings.createLock().set(set);
        //showToast('changessaved');
        SettingsService.navigate("carrier");
      },
      // BDC wangzhigang porting arg data roaming menu to bts. end

      setValue: function(evt) {
        let enabled = (evt.target.value === '1') || false;
        if (currentSettingsValue === enabled) {
          NavigationMap.navigateBack();
          return;
        }

        let lock = navigator.mozSettings.createLock();
        let option = {};
        option['ril.data.roaming_enabled'] = enabled;

        let req = lock.set(option).then(() => {
          SettingsService.navigate('carrier');
        });

        switchOn.checked = enabled;
        switchOff.checked = !enabled;
      },

      updateInfo: function(enabled) {
        currentSettingsValue = enabled;
        switchOn.checked = enabled;
        switchOff.checked = !enabled;
      },

      onBeforeShow: function() {
        // BDC wangzhigang porting arg data roaming menu to bts. begin
/*
        SettingsSoftkey.init(this.elements.params);
        SettingsSoftkey.show();
        switchOn.addEventListener('click', this.setValue);
        switchOff.addEventListener('click', this.setValue);
        SettingsListener.observe('ril.data.roaming_enabled', false, this.updateInfo);
*/
        _self = this;
        SettingsSoftkey.init(_self.elements.params);
        SettingsSoftkey.show();
        // BDC wangzhigang porting arg data roaming menu to bts. end
      },

      // BDC wangzhigang porting arg data roaming menu to bts. begin
/*
      onShow: function (panel, options) {
        if (!options.isVisibilityChange) {
          SettingsDBCache.getSettings((result) => {
            let roamingEnabled = result['ril.data.roaming_enabled'];
            let liItem = panel.querySelectorAll('li');
            if (roamingEnabled) {
              requestFocus(panel, liItem[0]);
            } else {
              requestFocus(panel, liItem[1]);
            }
          });
        }
      },
*/
      // BDC wangzhigang porting arg data roaming menu to bts. end

      onBeforeHide: function() {
        // BDC wangzhigang porting arg data roaming menu to bts. begin
/*
        switchOn.removeEventListener('click', this.setValue);
        switchOff.removeEventListener('click', this.setValue);
        SettingsListener.unobserve('ril.data.roaming_enabled', this.updateInfo);
*/
        SettingsSoftkey.hide();
        // BDC wangzhigang porting arg data roaming menu to bts. end
      },

      initUI: function() {
        // BDC wangzhigang porting arg data roaming menu to bts. begin
/*
        switchOn = this.elements.panel.querySelector("li input[value='1']");
        switchOff = this.elements.panel.querySelector("li input[value='0']");
*/
          var elements = this.elements;
          var defaultServiceIdrequest = window.navigator.mozSettings.createLock().get('ril.data.defaultServiceId');
          defaultServiceIdrequest.onsuccess = function onSuccessHandler() {
              var defaultServiceID = parseInt(defaultServiceIdrequest.result['ril.data.defaultServiceId'], 10);
              let matchInfo = {
                "clientId": "0"
              };
              matchInfo.clientId = defaultServiceID;
              // Show current roaming type according to current customization value
              window.navigator.customization.getValueForCarrier(matchInfo, 'stz.roaming.domestic.enable').then((result) => {
                  dataRoamingCustomized = (result === 'undefined') ? false : result;
                  console.log('[initialize] read data roaming customized value: ' + dataRoamingCustomized);
                  elements.dataRoamingKey = dataRoamingCustomized
                      ? 'data.roaming.domestic_international.enabled'
                      : 'ril.data.roaming_enabled';

                  var request = window.navigator.mozSettings.createLock().get(elements.dataRoamingKey);
                  request.onsuccess = function() {
                      var value = request.result[elements.dataRoamingKey];
                      console.log('[initialize] read \'' + elements.dataRoamingKey + '\' value: ' + value);
                      if (value === undefined) {
                             window.navigator.customization.getValueForCarrier(matchInfo, elements.dataRoamingKey).then((result) => {
                             value = (result === 'undefined') ? 0 : result;
                             console.log('[initialize] read customization \'' + elements.dataRoamingKey + '\' value: ' + value);
                             var set = {};
                             set[elements.dataRoamingKey] = value;
                             window.navigator.mozSettings.createLock().set(set);
                             var selector = 'li input[value=\'' + value + '\']';
                             elements.panel.querySelector('li input[value=\'' + value + '\']').click();
                          });
                      } else {
                          value = dataRoamingCustomized ? value : (value ? 1 : 0);
                          console.log('[initialize] set selector value: ' + value);
                          var selector = 'li input[value=\'' + value + '\']';
                          elements.panel.querySelector('li input[value=\'' + value + '\']').click();
                      }
                  };
              });
          };
          /// BDC wangzhigang modify for Domestic data roaming menu function. end
      }
    });
  };
});
