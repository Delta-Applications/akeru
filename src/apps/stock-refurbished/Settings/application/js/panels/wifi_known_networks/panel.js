define(['require','modules/wifi_utils','shared/wifi_helper','modules/wifi_context','modules/settings_panel','shared/simslot_manager','panels/wifi_known_networks/wifi_known_networks'],function(require) {
  

  var WifiUtils = require('modules/wifi_utils');
  var WifiHelper = require('shared/wifi_helper');
  var wifiManager = WifiHelper.getWifiManager();
  var WifiContext = require('modules/wifi_context');
  var SettingsPanel = require('modules/settings_panel');
  var SIMSlotManager = require('shared/simslot_manager');
  var WifiKnownNetworks =
    require('panels/wifi_known_networks/wifi_known_networks');

  return function ctor_wifi_knownNetwork() {
    var elements = {};
    var listItems = {};

    // In order to prevent CSK trigger click event.
    // Only the Right Softkey can forget the current network.
    var _isDialogShow = false;



    function _onWifiStatusChange (event) {
      if ('connected' !== event.status) {
        return;
      }

      for (let key in listItems) {
        let networkObj = JSON.parse(listItems[key].dataset.network);

        if (networkObj.ssid === event.network.ssid &&
          networkObj.security[0] === event.network.security[0]) {
          listItems[key].querySelector('small').setAttribute('data-l10n-id',
            'shortStatus-connected');
        }
      };
    }

    function _onWifiEnabled (event) {
      var activeItem =
        elements.knownNetworkListWrapper.querySelector('.active');
      WifiUtils.updateListItemStatus({
        listItems: listItems,
        activeItemDOM: activeItem,
        network: event.network,
        networkStatus: event.status
      });
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          panel: panel,
          knownNetworkListWrapper: panel.querySelector('.wifi-knownNetworks')
        };
      },

      onBeforeShow: function(panel) {
        this._cleanup();
        this._scan();
        this._initSoftKey();
        WifiContext.addEventListener('wifiEnabled', _onWifiEnabled);
        WifiContext.addEventListener('wifiStatusChange', _onWifiStatusChange);
      },

      onBeforeHide:function(){
        WifiContext.removeEventListener('wifiEnabled', _onWifiEnabled);
        WifiContext.removeEventListener('wifiStatusChange',
          _onWifiStatusChange);
      },

      _scan: function() {
        var self = this;
        WifiKnownNetworks.scan(function(networks) {
          var networkKeys = Object.getOwnPropertyNames(networks);
          var network;
          var simmcc, simmnc;
          var primarySimSlot = SIMSlotManager.getSlots()[0];
          if (primarySimSlot && primarySimSlot.simCard && primarySimSlot.simCard.iccInfo) {
            simmcc = primarySimSlot.simCard.iccInfo.mcc;
            simmnc = primarySimSlot.simCard.iccInfo.mnc;
          }
          if(simmcc===""||simmcc===undefined){
            primarySimSlot = SIMSlotManager.getSlots()[1];
            if (primarySimSlot && primarySimSlot.simCard && primarySimSlot.simCard.iccInfo) {
              simmcc = primarySimSlot.simCard.iccInfo.mcc;
              simmnc = primarySimSlot.simCard.iccInfo.mnc;
            }
          }
          console.log("now:@simmcc"+simmcc+"@simmnc:"+simmnc);

          if (networkKeys.length) {
            networkKeys.sort();

            var knownNetwork = {};
            for (var i = 0; i < networkKeys.length; i++) {
              network = networks[networkKeys[i]];
              var aItem = WifiUtils.newListItem({
                network: network,
                onClick: self._forgetNetwork.bind(self),
                showNotInRange: false,
                knownNetworks: knownNetwork
              });

              //Only show SingTel / Swisscom_Auto_Login / Vodafone wifi / MEO-WiFi.x
              //when corresponding sim inserted
              if (networkKeys[i] === 'SingTel WIFI' || networkKeys[i]=='Singtel WIFI') {
                if (simmcc != '525' || simmnc != '01') {
                  continue;
                }
              }
              if (networkKeys[i] === 'VodafoneWiFi') {
                if (simmcc != '234' || simmnc != '15') {
                  continue;
                }
              }
              if (networkKeys[i] === 'Swisscom_Auto_Login') {
                if (simmcc != '228' || simmnc != '01') {
                  continue;
                }
              }

              if (networkKeys[i] === 'MEO-WiFi.x') {
                if (simmcc != '268' || simmnc != '06') {
                  continue;
                }
              }

              if (WifiHelper.isConnected(network)) {
                elements.knownNetworkListWrapper.insertBefore(
                  aItem, elements.knownNetworkListWrapper.firstChild);
              } else {
                elements.knownNetworkListWrapper.appendChild(aItem);
              }

              // We have to keep them so that we can easily update
              // its status without cleanup
              listItems[networkKeys[i]] = aItem;
            }
          } else {
            // display a "no known networks" message if necessary
            var li = WifiUtils.newExplanationItem('noKnownNetworks') ;
            li.classList.add('non-focus');
            elements.knownNetworkListWrapper.appendChild(li);
            SettingsSoftkey.hide();
          }
          var evt = new CustomEvent('panelready', {
            detail: {
              current: Settings.currentPanel
            }
          });
          window.dispatchEvent(evt);
        }.bind(this));
      },
      _cleanup: function() {
        var wrapper = elements.knownNetworkListWrapper;
        while (wrapper.hasChildNodes()) {
          wrapper.removeChild(wrapper.firstChild);
        }
        listItems = {};
      },

      _initSoftKey: function() {
        var self = this;
        var softkeyParams = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Forget',
            l10nId: 'forget',
            priority: 3,
            method: function() {
              _isDialogShow = true;
              var network = elements.panel.querySelector('.wifi.focus a');
              var networkObj = JSON.parse(network.parentNode.dataset.network);
              var key = networkObj.security[0];
              if (key === 'WAPI-PSK' || key === 'WAPI-CERT') {
                self._forgetNetwork(new window.MozWifiNetwork(networkObj));
              } else {
                network.click();
              }
            }
          }]
        };
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      },

      _forgetNetwork: function(network) {
        var self = this;
        var dialogConfig = {
          title: {id: 'forgetNetwork-confirmation', args: {}},
          body: {id: 'forgetNetwork-dialog', args: {}},
          cancel: {
            l10nId:'cancel',
            priority:1,
            callback: function(){
              dialog.destroy();
              _isDialogShow = false;
            },
          },
          confirm: {
            l10nId: 'forget',
            priority: 3,
            callback: function(){
              var request = wifiManager.forget(network);
              request.onsuccess = function() {
                showToast('networkforget');
                self._cleanup();
                self._scan();
              };
              dialog.destroy();
              _isDialogShow = false;
            },
          },
        };

        if (_isDialogShow) {
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
        }
      }
    });
  };
});
