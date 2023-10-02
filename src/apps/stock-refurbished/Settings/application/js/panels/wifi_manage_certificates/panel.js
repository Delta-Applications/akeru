
define('panels/wifi_manage_certificates/panel',['require','modules/wifi_utils','shared/wifi_helper','modules/settings_panel'],function(require) {
  
  var WifiUtils = require('modules/wifi_utils');
  var WifiHelper = require('shared/wifi_helper');
  var SettingsPanel = require('modules/settings_panel');

  return function ctor_manageCertificatedWifi() {
    var elements = {};
    var wifiManager = WifiHelper.getWifiManager();

    function _initSoftKey(options) {
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [options]
      };

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _showSelectSoftKey() {
      var items = {
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      };

      _initSoftKey(items);
    }

    function _showDeleteSoftKey(nickname) {
      var items = {
        name: 'Delete',
        l10nId: 'delete',
        priority: 3,
        method: function() {
          _showConfirmDialog(nickname);
        }
      };

      _initSoftKey(items);
    }

    function _newCertificateItem(nickname) {
      var span = document.createElement('span');
      span.textContent = nickname;
      span.id = nickname;
      span.classList.add('certificate-file');

      var li = document.createElement('li');
      li.setAttribute('role', 'menuitem');
      li.appendChild(span);

      return li;
    }

    function _showConfirmDialog(nickname) {
      var dialogConfig = {
        title: {id: 'confirmation', args: {}},
        body: {
          id: 'delete-certificate-confirm-msg',
          args: {
            certificateName: nickname
          }
        },
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            dialog.destroy();
          }
        },
        confirm: {
          name: 'Delete',
          l10nId: 'delete',
          priority: 3,
          callback: function() {
            dialog.destroy();
            _deleteCertificate(nickname);
          }
        }
      };

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _deleteCertificate(nickname) {
      var scanWhenDeleteError = () => {
        // Pop out alert message for certificate deletion failed
        var dialog = elements.deleteCertificateFailedDialog;
        dialog.hidden = false;
        dialog.onsubmit = () => {
          _scan();
          dialog.hidden = true;
        };
      };

      wifiManager.deleteCert(nickname).then(() => {
        var item = document.getElementById(nickname).parentNode;
        elements.certificateList.removeChild(item);
        showToast('certificate-deleted');

        var list = elements.certificateList;
        var certificateItems = list.querySelectorAll('li');
        if (certificateItems.length === 0) {
          _showNoCertificatesInfo(list);
        }

        NavigationMap.refresh();
      }, () => {
        scanWhenDeleteError();
      });
    }

    function _showNoCertificatesInfo(list) {
      var li = WifiUtils.newExplanationItem('noImportedCertificates');
      li.classList.add('non-focus');
      list.appendChild(li);
    }

    function _scan() {
      _cleanup();

      var list = elements.certificateList;

      wifiManager.getImportedCerts().then((result) => {
        var certList = result;
        // save the imported server certificates
        var certificateList = certList.ServerCert;

        // display certificate list
        if (certificateList.length) {
          for (var i = 0; i < certificateList.length; i++) {
            var aItem = _newCertificateItem(certificateList[i]);
            list.appendChild(aItem);
          }

          // Add event listener for updating delete cert. soft-key
          var updateSoftKey = (evt) => {
            var nickname = evt.target.textContent;
            if (nickname === null) {
              return;
            }

            _showDeleteSoftKey(nickname);
          };

          var j = 0;
          var certificateItems = list.querySelectorAll('li');
          var length = certificateItems.length;
          for (j; j < length; j++) {
            certificateItems[j].addEventListener('focus', updateSoftKey);
          }
        } else {
          // show "no certificates" message
          _showNoCertificatesInfo(list);
        }

        NavigationMap.refresh();
      }, () => {
        console.warn('getImportedCerts failed');
      });
    }

    function _cleanup() {
      while (elements.certificateList.hasChildNodes()) {
        elements.certificateList.removeChild(
          elements.certificateList.lastChild
        );
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          panel: panel,
          certificateList: panel.querySelector('.wifi-certificateList'),
          importCertificate: panel.querySelector('.operate-certificate li'),
          deleteCertificateFailedDialog:
            panel.querySelector('.certificate-deletion-failed')
        };
      },

      onBeforeShow: function(panel) {
        _scan();
        _showSelectSoftKey();
      },

      onBeforeHide: function() {
      },

      onShow: function() {
        elements.importCertificate.addEventListener('focus',
          _showSelectSoftKey);
      },

      onHide: function() {
        elements.importCertificate.removeEventListener('focus',
          _showSelectSoftKey);
      }
    });
  };
});
