(function (exports) {
  var lastParams;
  var softkey = new SoftkeyPanel({
    menuClassName: 'menu-button',
    items: [
      {
        name: 'create',
        l10nId: '',
        priority: 1,
        method: function () {
          console.log("SettingsSoftkey created");
        }
      }]
  });
  var SettingsSoftkey = {

    get visible() {
      var softKeyPanel = document.querySelector('#' + FORM_ID);
      if (softKeyPanel && softKeyPanel.classList.contains('visible'))
        return true;
      else
        return false;
    },

    init: function (params) {
      if (params && params.items && params.items.length &&
        (params.items[0].l10nId || params.header !== 'empty')) {
        lastParams = params;
      }
      softkey.initSoftKeyPanel(params);
    },

    show: function () {
      if (!SettingsSoftkey.visible &&
        softkey.actions && !softkey.actions[0].l10nId &&
        softkey.header === 'empty' && lastParams) {
        SettingsSoftkey.init(lastParams);
      }
      softkey.show();
    },

    hide: function () {
      if (SettingsSoftkey.visible) {
        var params = {
          header: 'empty',
          items: [{
            name: '',
            l10nId: '',
            priority: 1,
            method: () => {
            }
          }]
        };
        SettingsSoftkey.init(params);
      }
      /**
       * When the app becomes invisible, we shouldn't make the soft key hide to
       * avoid soft key displayed slower when app becomes visible.
       */
      if (document.hidden) {
        return;
      }
      softkey.hide();
    },

    menuVisible: function () {
      return softkey.menuVisible;
    },

    getSoftkey: function () {
      return softkey;
    }
  };

  exports.SettingsSoftkey = SettingsSoftkey;

})(this);

