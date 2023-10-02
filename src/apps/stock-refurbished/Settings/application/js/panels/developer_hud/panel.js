
/**
 * Handle support panel functionality with SIM and without SIM
 */
define('panels/developer_hud/developer_hud',['require','shared/settings_listener'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');

  /**
   * @alias module:developer_hud/developer_hud
   * @class DeveloperHud
   * @returns {DeveloperHud}
   */
  var DeveloperHud = function() {
    this._elements = {};
  };

  DeveloperHud.prototype = {
    /**
     * Initialization.
     *
     * @access public
     * @memberOf DeveloperHud.prototype
     * @param  {Object} elements
     */
    init: function about_init(elements) {
      this._elements = elements;
      SettingsListener.observe('devtools.overlay', false,
        (enabled) => {
          [].forEach.call(this._elements.widgets, function(widget) {
            widget.classList.toggle('disabled', !enabled);

          });
          var lis = this._elements.widgets[0].getElementsByTagName('li');
          [].forEach.call(lis, function(li) {
            if (!enabled) {
              li.setAttribute('aria-disabled', true);
            } else {
              li.removeAttribute('aria-disabled');
            }
          });
          var inputs =
            this._elements.widgets[0].getElementsByTagName('input');
          [].forEach.call(inputs, function (input) {
            input.disabled = !enabled;
          });
          var selects =
            this._elements.widgets[0].getElementsByTagName('select');
          [].forEach.call(selects, function (select) {
            select.disabled = !enabled;
          })

        });

      SettingsListener.observe('hud.appmemory', false,
        (enabled) => {
          [].forEach.call(this._elements.items, function(item) {
            var li = item.parentElement.parentElement;
            var input = item.parentElement.getElementsByTagName('input')[0];
            if (!enabled) {
              li.setAttribute('aria-disabled', true);
              input.disabled = true;
            } else {
              li.removeAttribute('aria-disabled');
              input.disabled = false;
            }
          });
        });
    }
  };

  return function ctor_developer_hud_panel() {
    return new DeveloperHud();
  };
});

/**
 * Used to show Device/developer hud panel
 */
define('panels/developer_hud/panel',['require','modules/settings_panel','panels/developer_hud/developer_hud'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var DeveloperHud = require('panels/developer_hud/developer_hud');

  return function ctor_developer_hud_panel() {
    var developerHud = DeveloperHud();

    return SettingsPanel({
      onInit: function(panel) {
        var elements = {
          widgets: panel.querySelectorAll('.hud-widgets'),
          items: panel.querySelectorAll('.memory-item')
        };
        developerHud.init(elements);
      }
    });
  };
});
