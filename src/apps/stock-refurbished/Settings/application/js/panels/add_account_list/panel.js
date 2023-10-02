define(['require','modules/settings_panel','modules/settings_service','modules/apps_cache'],function (require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var AppsCache = require('modules/apps_cache');

  return function ctor_support_panel() {
    var progressBar = null;
    var list = null;

    function showGoogleLoginPage(evt) {
      if (evt.key === 'Enter') {
        showLoginPage('google');
      }
    }

    function showActiveSyncLoginPage(evt) {
      if (evt.key === 'Enter') {
        showLoginPage('activesync');
      }
    }

    function showLoginPage(accountType) {
      debugInfo('showLoginPage() - accountType=' + accountType);
      let authenticator = {authenticatorId: accountType};
      let extraInfo = {
        headerBackgroundColor: 'var(--header-blue-background)'
      };
      progressBar.hidden = false;
      list.hidden = true;
      navigator.accountManager.showLoginPage(authenticator, extraInfo).then(
        (result) => {
          debugInfo('showLoginPage resolved');
          SettingsService.navigate('root');
          progressBar.hidden = true;
          list.hidden = false;
        }, (reason) => {
          debugInfo('showLoginPage rejected: ' + reason);
          showErrorDialog(reason);
          progressBar.hidden = true;
          list.hidden = false;
        }
      );
    }

    return SettingsPanel({
      onInit: function (panel) {
        this.googleAccount = panel.querySelector('#li-google');
        this.activeSyncAccount = panel.querySelector('#li-activesync');
        progressBar = panel.querySelector('#login-progress');
        list = panel.querySelector('#account-list');

        AppsCache.apps().then(function (apps) {
          for (let i = 0; i < apps.length; i++) {
            if (apps[i].origin === 'app://email.gaiamobile.org') {
              this.activeSyncAccount.hidden = false;
              break;
            }
          }
        }.bind(this));

        if (window.ActivityHandler) {
          let header = panel.querySelector('#header');
          header.setAttribute('data-href', '#accounts');
        }
      },
      onBeforeShow: function () {
        progressBar.hidden = true;
        list.hidden = false;
        this.googleAccount.addEventListener('keydown', showGoogleLoginPage);
        this.activeSyncAccount.addEventListener('keydown',
          showActiveSyncLoginPage);
      },
      onBeforeHide: function () {
        this.googleAccount.removeEventListener('keydown', showGoogleLoginPage);
        this.activeSyncAccount.removeEventListener('keydown',
          showActiveSyncLoginPage);
      }
    });
  };
});
