/* exported WifiHelper */


var WifiHelper = {
  getWifiManager: function() {
    return this.wifiManager;
  },

  wifiManager: function() {
    return navigator.mozWifiManager;
  }(),

  setPassword: function(network, password, identity, eap, phase2, certificate,
                        keyIndex) {
    var encType = this.getKeyManagement(network);
    switch (encType) {
      case 'WPA-PSK':
      case 'WPA2-PSK':
      case 'WPA/WPA2-PSK':
        network.psk = password;
        break;
      case 'WAPI-PSK':
        network.wapi_psk = password;
        break;
      case 'WPA-EAP':
        network.eap = eap;
        switch (eap) {
          case 'SIM':
          case 'AKA':
          case "AKA'":
            break;
          case 'PEAP':
          case 'TLS':
          case 'TTLS':
            if (password && password.length) {
              network.password = password;
            }
            if (identity && identity.length) {
              network.identity = identity;
            }
            if (phase2 != 'No') {
              network.phase2 = phase2;
            }
            if (certificate != 'none') {
              network.serverCertificate = certificate;
            }
            break;
          default:
            break;
        }
        break;
      case 'WEP':
        network.wep = password;
        network.keyIndex = keyIndex;
        break;
      default:
        return;
    }
    network.keyManagement = encType;
  },

  setSecurity: function(network, encryptions) {
    network.security = encryptions;
  },

  _setSecurity: function(network, encryptions) {
    if (encryptions.length === 0) {
      return;
    }
    network.security[0] = encryptions[0];
  },

  _setSignalStrength: function(network, strength) {
    network.signalStrength = strength;
  },

  _setRelSignalStrength: function(network, strength) {
    network.relSignalStrength = strength;
  },

  getSecurity: function(network) {
    return network.security;
  },

  getCompositedKey: function(network) {
    var self = this;
    var security = self.getKeyManagement(network);
    switch (security) {
      case 'WPA-PSK':
      case 'WPA2-PSK':
      case 'WPA/WPA2-PSK':
        security = 'WPA-PSK';
        break;
      default:
        break;
    }
    // use ssid + security as a composited key
    var key = network.ssid + '+' + security;
    return key;
  },

  getCapabilities: function(network) {
    return network.capabilities === undefined || network.capabilities === null ?
           [] : network.capabilities;
  },

  getKeyManagement: function(network) {
    var key = this.getSecurity(network)[0];
    if (/WEP$/.test(key)) {
      return 'WEP';
    }
    if (/WAPI-PSK$/.test(key)) {
      return 'WAPI-PSK';
    }
    if (/PSK$/.test(key)) {
      return 'WPA-PSK';
    }
    if (/WPA2-PSK$/.test(key)) {
      return 'WPA2-PSK';
    }
    if (/WPA\/WPA2-PSK$/.test(key)) {
      return 'WPA/WPA2-PSK';
    }
    if (/EAP$/.test(key)) {
      return 'WPA-EAP';
    }
    if (/WAPI-CERT$/.test(key)) {
      return 'WAPI-CERT';
    }
    return '';
  },

  isConnected: function(network) {
    var self = this;
    /**
     * XXX the API should expose a 'connected' property on 'network',
     * and 'wifiManager.connection.network' should be comparable to 'network'.
     * Until this is properly implemented, we just compare SSIDs to tell wether
     * the network is already connected or not.
     */
    var currentNetwork = self.wifiManager.connection.network;
    if (!currentNetwork || !network) {
      return false;
    }
    var key = self.getCompositedKey(network);
    var curkey = self.getCompositedKey(currentNetwork);
    return key === curkey && currentNetwork.connected;
  },

  isValidInput: function(key, password, identity, eap) {
    function isValidWepKey(password) {
      switch (password.length) {
        case 5:
        case 13:
        case 16:
        case 29:
          return true;
        case 10:
        case 26:
        case 32:
        case 58:
          return !/[^a-fA-F0-9]/.test(password);
        default:
          return false;
      }
    }

    if (key === 'WAPI-CERT') {
      return false;
    }

    switch (key) {
      case 'WPA-PSK':
      case 'WPA2-PSK':
      case 'WPA/WPA2-PSK':
      case 'WAPI-PSK':
        if (!password || password.length < 8) {
          return false;
        }
        break;
      case 'WPA-EAP':
        switch (eap) {
          case 'SIM':
          case 'AKA':
          case "AKA'":
            break;
          case 'PEAP':
          case 'TLS':
          case 'TTLS':
            /* falls through */
          default:
            if (!password || password.length < 1 ||
                !identity || identity.length < 1) {
              return false;
            }
            break;
        }
        break;
      case 'WEP':
        if (!password || !isValidWepKey(password)) {
          return false;
        }
        break;
    }
    return true;
  },

  isWpsAvailable: function(network) {
    var capabilities = this.getCapabilities(network);
    for (var i = 0; i < capabilities.length; i++) {
      if (/WPS/.test(capabilities[i])) {
        return true;
      }
    }
    return false;
  },

  isOpen: function(network) {
    return this.getKeyManagement(network) === '';
  },

  isEap: function(network) {
    return this.getKeyManagement(network).indexOf('EAP') !== -1;
  },

  // Both 'available' and 'known' are "object of networks".
  // Each key of them is a composite key of a network,
  // and each value is the original network object received from DOMRequest
  // It'll be easier to compare in the form of "object of networks"
  _unionOfNetworks: function(available, known) {
    var self = this;
    var allNetworks = available || {};
    var result = [];

    // Set the available network configuration parameter into known network
    //   and push the new network object to all network list.
    Object.keys(known).forEach(key => {
      if (allNetworks[key]) {
        self._setSecurity(known[key], allNetworks[key].security);
        self._setSignalStrength(known[key], allNetworks[key].signalStrength);
        self._setRelSignalStrength(known[key],
          allNetworks[key].relSignalStrength);
        allNetworks[key] = known[key];
      }
    });

    // However, people who use getAvailableAndKnownNetworks expect
    // getAvailableAndKnownNetworks.result to be an array of network
    Object.keys(allNetworks).forEach(key => {
      result.push(allNetworks[key]);
    });
    return result;
  },

  _networksArrayToObject: function(allNetworks) {
    var self = this;
    var networksObject = {};
    [].forEach.call(allNetworks, network => {
      var key = self.getCompositedKey(network);
      networksObject[key] = network;
    });
    return networksObject;
  },

  _onReqProxySuccess: function(reqProxy, availableNetworks, knownNetworks) {
    reqProxy.result =
      this._unionOfNetworks(availableNetworks, knownNetworks);
    reqProxy.onsuccess();
  },

  getAvailableAndKnownNetworks: function() {
    var self = this;
    var reqProxy = {
      onsuccess: function() {},
      onerror: function() {}
    };
    var knownNetworks = {};
    var availableNetworks = {};
    var knownNetworksReq = null;
    var availableNetworksReq = this.getWifiManager().getNetworks();

    // request available networks first then known networks,
    // since it is acceptible that error on requesting known networks
    availableNetworksReq.onsuccess = function anrOnSuccess() {
      availableNetworks =
        self._networksArrayToObject(availableNetworksReq.result);
      knownNetworksReq = self.getWifiManager().getKnownNetworks();
      knownNetworksReq.onsuccess = function knrOnSuccess() {
        knownNetworks = self._networksArrayToObject(knownNetworksReq.result);
        self._onReqProxySuccess(
          reqProxy, availableNetworks, knownNetworks);
      };
      knownNetworksReq.onerror = function knrOnError() {
        // it is acceptible that no known networks found or error
        // on requesting known networks
        self._onReqProxySuccess(
          reqProxy, availableNetworks, knownNetworks);
      };
    };
    availableNetworksReq.onerror = function anrOnError() {
      reqProxy.error = availableNetworksReq.error;
      reqProxy.onerror();
    };
    return reqProxy;
  }
};
