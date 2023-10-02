/* global PerformanceTestingHelper */
define(['require','modules/dialog_service','modules/wifi_utils','shared/wifi_helper','modules/wifi_context','modules/settings_service'],function(require) {
  

  var DialogService = require('modules/dialog_service');
  var WifiUtils = require('modules/wifi_utils');
  var WifiHelper = require('shared/wifi_helper');
  var WifiContext = require('modules/wifi_context');
  var SettingsService = require('modules/settings_service');
  var wifiManager = WifiHelper.getWifiManager();

  var WifiNetworkList = function(elements,callback) {
    var list = elements.wifiAvailableNetworks;

    var wifiNetworkList = {
      _scanRate: 15000, // 15s after last scan results
      _scanning: false,
      _autoscan: false,
      _panel: null,
      _timerID: null,
      _focusIndex: 0,
      _rescanFlag: false,
      _dialogPanelShow: false,
      _index: {}, // index of all scanned networks
      _networks: {},
      _list: elements.wifiAvailableNetworks,
      _wifiStatusFlag: false,
      _showSearchStatus: function(enabled) {
        list.hidden = enabled;
        elements.infoItem.hidden = !enabled;
      },
      clear: function() {
        // clear the network list
        this._index = {};

        // remove all items except the text expl.
        // and the "search again" button
        var wifiItems = list.querySelectorAll('li');
        var len = wifiItems.length;
        for (var i = len - 1; i >= 0; i--) {
          list.removeChild(wifiItems[i]);
        }
      },

      getFocusIndex: function() {
        this._focusIndex = 0;

        var wifiItems = list.querySelectorAll('li');
        var focus = list.querySelector('li.focus');

        if (!wifiItems || !focus) {
          return;
        }

        var focusNetwork = JSON.parse(focus.dataset.network);
        for (var i = 0; i < wifiItems.length; i++) {
          var network = JSON.parse(wifiItems[i].dataset.network);
          if (focusNetwork.ssid === network.ssid &&
            focusNetwork.security[0] === network.security[0]) {
            this._focusIndex = i;
            return;
          }
        }
      },

      refreshFocus: function() {
        var wifiItems = list.querySelectorAll('li');
        if (wifiItems.length > 0) {
          if (wifiItems.length < this._focusIndex + 1) {
            this._focusIndex = wifiItems.length - 1;
          }
          wifiItems[this._focusIndex].classList.add('focus');
          wifiItems[this._focusIndex].focus();
          wifiItems[this._focusIndex].scrollIntoView(false);
        }
      },

      newWifiListItem: function(networkKeys, knownNetwork) {
        var network;
        var self = this;
        var offlineString = 'shortStatus-disconnected';

        self.getFocusIndex();
        self.clear();
        // add detected networks
        var nodeForOffline = null;

        for (let k = 0; k < knownNetwork.length;) {
          let flag = false
          for (let networkScan in self._networks) {
            if (self._networks[networkScan].ssid === knownNetwork[k].ssid &&
              WifiHelper.getKeyManagement(self._networks[networkScan]) !==
              WifiHelper.getKeyManagement(knownNetwork[k])) {
              flag = true;
              WifiContext.forgetNetwork(knownNetwork[k]);
              knownNetwork.splice(k,1);
              break;
            }
          }

          if (!flag) {
            k++;
          }
        }

        for (var j = 0; j < networkKeys.length; j++) {
          network = self._networks[networkKeys[j]];

          if (!WifiUtils.wlanEnabled
              && (network.security[0] === 'WAPI-PSK'
                  || network.security[0] === 'WAPI-CERT')) {
            continue;
          }

          var listItem = WifiUtils.newListItem({
            network: network,
            onClick: self._toggleNetwork.bind(self),
            showNotInRange: true,
            knownNetworks: knownNetwork
          });

          // put connected network on top of list
          if (WifiHelper.isConnected(network)) {
            if (list.childNodes.length !== 0) {
              list.insertBefore(listItem, list.childNodes[0]);
              if (!nodeForOffline) {
                nodeForOffline = list.childNodes[0];
              }
            } else {
              list.appendChild(listItem);
              nodeForOffline = list.childNodes[0];
            }
          } else if (listItem.querySelector('a small').dataset.l10nId ===
            offlineString) {
            if (list.childNodes.length !== 0) {
              if (!nodeForOffline) {
                list.insertBefore(listItem, list.childNodes[0]);
                nodeForOffline = list.childNodes[0];
              } else {
                list.insertBefore(listItem, nodeForOffline.nextSibling);
                nodeForOffline = nodeForOffline.nextSibling;
              }
            } else {
              list.appendChild(listItem);
              nodeForOffline = list.childNodes[0];
            }
          } else {
            list.appendChild(listItem);
          }

          // add composited key to index
          self._index[networkKeys[j]] = listItem;
        }
      },

      scan: function(toastFlag) {
        var self = this;

        // scan wifi networks and display them in the list
        if (this._scanning) {
          return;
        }

        // stop auto-scanning if wifi disabled or the app is hidden
        if (!wifiManager.enabled || document.hidden) {
          this._scanning = false;
          return;
        }

        let progressItem =
          wifiNetworkList._panel.querySelector('.searching_icon progress');
        if (!progressItem) {
          progressItem = document.createElement('progress');

          let searchingText = '.searching_icon .searching-text';
          let wifiSearchText =
            wifiNetworkList._panel.querySelector(searchingText);
          let wifiSearchItem =
            wifiNetworkList._panel.querySelector('.searching_icon');
          wifiSearchItem.insertBefore(progressItem, wifiSearchText);
        }

        let wifiItems = this._list.querySelectorAll('li');
        if (0 === wifiItems.length) {
          this._showSearchStatus(true);
        }

        this._scanning = true;
        var req = WifiHelper.getAvailableAndKnownNetworks();

        req.onsuccess = function onScanSuccess() {
          var allNetworks = req.result;
          var network;

          self._networks = {};
          for (var i = 0; i < allNetworks.length; ++i) {
            network = allNetworks[i];
            var key = WifiUtils.getNetworkKey(network);
            // keep connected network first, or select the highest strength
            if (!self._networks[key] || network.connected) {
              self._networks[key] = network;
            } else {
              if (!self._networks[key].connected &&
                network.relSignalStrength >
                  self._networks[key].relSignalStrength) {
                    self._networks[key] = network;
              }
            }
          }

          var networkKeys = Object.getOwnPropertyNames(self._networks);

          new Promise(function(resolve, reject) {
            // display network list
            if (networkKeys.length) {
              let noWifiItem = document.querySelector(
                '#wifi-available-networks .no-wifi-network');
              if (noWifiItem) {
                noWifiItem.classList.add('hidden');
              }

              var knownNetwork = [];

              // sort networks by signal strength
              networkKeys.sort(function(a, b) {
                return self._networks[b].relSignalStrength -
                  self._networks[a].relSignalStrength;
              });

              var request = wifiManager.getKnownNetworks();
              request.onsuccess = function() {
                resolve(request.result);
              };

              request.onerror = function(error) {
                reject(error);
              };
            } else {
              // display a "no networks found" message if necessary
              let noWifiItem = document.querySelector(
                '#wifi-available-networks .no-wifi-network');
              if (noWifiItem) {
                noWifiItem.classList.remove('hidden');
              }

              reject();
            }
          }).then(function (value) {
            self.newWifiListItem(networkKeys, value);
          }, function (error) {
            if (networkKeys.length > 0) {
              var knownNet = [];
              self.newWifiListItem(networkKeys, knownNet);
            } else {
              self.clear();
            }
            console.warn('Error : ', error);
            console.warn('scan: could not retrieve any known network.');
          }).then( () => {
            // hide the "Searching" status
            self._showSearchStatus(false);
            if (callback && typeof callback === 'function') {
              callback();
            }
            var liItem = list.querySelector('.focus');
            if (liItem) {
              liItem.classList.remove('focus');
              self.refreshFocus();
            }

            if (self._rescanFlag) {
              self._rescanFlag = false;
              showToast('rescanComplete');
            }

            if (toastFlag && (!wifiManager || !wifiManager.connection ||
              'connected' !== wifiManager.connection.status)) {
              showToast('select-a-network');
            }

            self._scanning = false;
          });
        };

        req.onerror = function onScanError(error) {
          // always try again.
          self._scanning = false;

          window.setTimeout(self.scan.bind(self), self._scanRate);
        };
      },

      startAutoscanTimer: function() {
        if (this._timerID) {
          window.clearInterval(this._timerID);
        }
        this._timerID =
          window.setInterval(this.scan.bind(this), this._scanRate);
      },

      getWpsAvailableNetworks: function() {
        // get WPS available networks
        var ssids = Object.getOwnPropertyNames(this._networks);
        var wpsAvailableNetworks = [];
        for (var i = 0; i < ssids.length; i++) {
          var network = this._networks[ssids[i]];
          if (WifiHelper.isWpsAvailable(network)) {
            wpsAvailableNetworks.push(network);
          }
        }
        return wpsAvailableNetworks;
      },
      set autoscan(value) {
        this._autoscan = value;
      },
      get autoscan() {
        return this._autoscan;
      },
      get scanning() {
        return this._scanning;
      },
      isSameSecurity(networkOne, networkTwo) {
        let ret = true;

        if (networkOne.security.length !== networkTwo.security.length) {
          ret = false;
        } else if (1 === networkOne.security.length &&
          networkOne.security[0] !== networkTwo.security[0]) {
          ret = false;
        }

        return ret;
      },
      _toggleNetwork: function(network, bodyId) {
        var self = this;

        if (WifiContext.currentNetwork &&
          WifiContext.currentNetwork.ssid === network.ssid &&
          self.isSameSecurity(WifiContext.currentNetwork, network)) {
          let relSignalStrength = network.relSignalStrength;
          let securityMode = network.security[0];
          network = WifiContext.currentNetwork;
          network.relSignalStrength = relSignalStrength;
          network.security[0] = securityMode;
        }

        var keys = WifiHelper.getSecurity(network);
        var security = (keys && keys.length) ? keys.join(', ') : 'Open';
        var sl = Math.min(Math.floor(network.relSignalStrength / 20), 4);

        var req = wifiManager.getKnownNetworks();
        var done = function () {
          var knownNetwork = false;
          var key = WifiUtils.getNetworkKey(network);
          for (let i in req.result) {
            if (WifiUtils.getNetworkKey(req.result[i]) === key) {
               knownNetwork = true;
               break;
            }
          }

          var isConnected = WifiHelper.isConnected(network);
          if (isConnected || knownNetwork && !bodyId) {
            if (self._wifiStatusFlag) {
              return;
            }
            self._wifiStatusFlag = true;
            // online: show status + offer to disconnect
            DialogService.show('wifi-status', {
              sl: sl,
              network: network,
              security: security,
              isConnected: isConnected,
              knownNetwork: knownNetwork,
            }).then(function(result) {
              self._wifiStatusFlag = false;
              var type = result.type;
              if (type === 'cancel') {
                WifiContext.forgetNetwork(network, function() {
                  showToast('networkforget');
                  self.scan();
                });
              }
            });
          } else {
            if (WifiUtils.toggleLogin === true) {
              return;
            }
            WifiUtils.toggleLogin = true;

            // offline, unknown network: propose to connect
            var key = WifiHelper.getKeyManagement(network);
            if (security === 'Open') {
              key = 'Open';
            }
            switch (key) {
              case 'WEP':
              case 'WPA-PSK':
              case 'WPA-EAP':
              case 'WPA2-PSK':
              case 'WPA/WPA2-PSK':
              case 'Open':
                network.password = null;
                DialogService.show('wifi-auth', {
                  sl: sl,
                  security: security,
                  network: network,
                }).then(function(result) {
                  WifiUtils.toggleLogin = false;
                  window.dispatchEvent(new CustomEvent('wifi-auth-submit'));

                  var type = result.type;
                  var authOptions = result.value;
                  if (type === 'submit' && authOptions.forget) {
                    WifiContext.forgetNetwork(network, function() {
                      showToast('networkforget');
                      self.scan();
                    });
                  }

                });
                break;
              case 'WAPI-PSK':
              case 'WAPI-CERT':
                SettingsService.navigate('wifi-auth-wapi');
                break;
              default:
                WifiUtils.toggleLogin = false;
                break;
            }
          }
        };

        req.onsuccess = done;
        req.onerror = done;
      }
    };

    var updateItemPosition = function updateConnectingItemPosition(network) {
      var key = WifiUtils.getNetworkKey(network);
      var connectedItem = wifiNetworkList._index[key];
      if (!connectedItem) {
        return;
      }

      if (list.childNodes.length !== 0) {
        list.insertBefore(connectedItem, list.childNodes[0]);
      } else {
        list.appendChild(connectedItem);
      }
      list.childNodes[0].focus();
      var evt = new CustomEvent('refresh');
      window.dispatchEvent(evt);
    };

    var wapiWifiStateChange = function wapiWifiStateChange(event) {
      if (!event.network) {
        return;
      }

      var ssid = event.network.ssid;
      var security = event.network.security[0];
      if (security !== 'WAPI-PSK' && security !== 'WAPI-CERT') {
        return;
      }

      var li = wifiNetworkList._panel.querySelectorAll('li.wifi');
      for (var i = 0; i < li.length; i++) {
        if (ssid === li[i].querySelector('span.ssid').textContent) {
          li[i].querySelector('a').removeAttribute('href');
          li[i].querySelector('a').onclick = e => {
            wifiNetworkList._toggleNetwork(event.network);
            e.stopPropagation();
          };
        }
      }
    };

    // networkStatus has one of the following values:
    // connecting, associated, connected, connectingfailed, disconnected.
    WifiContext.addEventListener('wifiEnabled', event => {
      WifiUtils.updateListItemStatus({
        listItems: wifiNetworkList._index,
        activeItemDOM: list.querySelector('.active'),
        network: event.network,
        networkStatus: event.status
      });
    });

    WifiContext.addEventListener('wifiStatusChange', event => {
      if (event.status === 'connected') {
        updateItemPosition(event.network);
      }

      if (event.status === 'connected' || event.status === 'disconnected') {
        wapiWifiStateChange(event);
        if (list.dataset.ssid === event.network.ssid) {
          list.dataset.ssid = null;
        }
      }

      WifiUtils.updateListItemStatus({
        listItems: wifiNetworkList._index,
        activeItemDOM: list.querySelector('.active'),
        network: event.network,
        networkStatus: event.status
      });
    });

    WifiContext.addEventListener('wifiConnectionInfoUpdate', event => {
      WifiUtils.updateNetworkSignal(event.network, event.relSignalStrength);
    });

    WifiContext.addEventListener('wifiHasInternet', event => {
      WifiUtils.updateHasInternetStatus({
        listItems: wifiNetworkList._index,
        network: event.network,
      });
    });

    WifiContext.addEventListener('wifiCaptive', event => {
      WifiUtils.updateCaptiveStatus({
        listItems: wifiNetworkList._index,
        network: event.network,
        loginSuccess: event.loginSuccess
      });
    });

    return wifiNetworkList;
  };

  return WifiNetworkList;
});
