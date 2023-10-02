/* global NavigationMap */

(function(exports) {
  
  var current = null;
  var rootTab = null;
  var activeTab = -1;
  var isRtl = () => 'rtl' === document.dir;
  function getTabsSize() {
    return RootManager.tabs.length;
  }

  function clearAll() {
    for (var i = 0; i < getTabsSize(); i++) {
      RootManager.tabs[i].classList.add("hidden");
    }
  }

  var RootManager = {
    get activeTab() {
      return activeTab;
    },
    set activeTab(index) {
      var size = getTabsSize();

      if (index < 0) {
        index = size - 1;
      }
      else if (index >= size) {
        index = 0;
      }

      clearAll();
      var oldActiveTab = activeTab;
      activeTab = index;
      rootTab.select(index);
      this.tabs[activeTab].classList.remove("hidden");
      /* Notify focus mechanism to update focus position */
      var detail = {
        newActiveTab: index,
        oldActiveTab: oldActiveTab,
        currentpage: '#root',
        current: '#root'
      };
      var event = new CustomEvent('panelready', {
        detail: detail
      });
      window.dispatchEvent(event);
    },

    init: function() {
      if (current === null && RootManager.activeTab === -1) {
        current = document.querySelector(".current");
        if (!navigator.mozId) {
          let list =
            document.querySelectorAll('.kaiaccount-customizable');
          list.forEach(dom => {
            dom.remove();
          });
        }
        this.tabs = current.querySelectorAll('.root .content');
        rootTab = document.getElementById('root-tab');
        RootManager.activeTab = 0;
      }
    },

    back: function() {
      this.activeTab = this.activeTab - 1;
    },

    next: function() {
      this.activeTab = this.activeTab + 1;
    },

    addTab: function(text) {
      if (document.querySelector(`a > [data-l10n-id=${text}]`)) {
        return;
      }
      var span = document.createElement('span');
      span.setAttribute('data-l10n-id', text);
      var a = document.createElement('a');
      a.appendChild(span);
      rootTab.addItem(a);

      // update tab views after tab added.
      this.tabs = document.querySelectorAll("#root .root .content");
      rootTab.select(rootTab.selected);
    },

    removeTab: function(text) {
      var iccTab = document.querySelector(`a > [data-l10n-id=${text}]`);
      var a = iccTab && iccTab.parentNode
      if (a) {
        a.parentNode.removeChild(a);
        this.tabs = document.querySelectorAll("#root .root .content");
        if (RootManager.activeTab >= this.tabs.length) {
          RootManager.activeTab = 0;
          rootTab.select(0);
        }
      }
    }
  };

  // Add the keydown event to switch the tabs
  window.addEventListener('keydown', function(e) {
    if (NavigationMap &&
        (!NavigationMap.currentSection ||
        NavigationMap.currentSection === '#root') &&
        document.activeElement.type != 'select-one' &&
        !NavigationMap.settingsListShow &&
        NavigationMap.currentActivatedLength === 0) {
        // Add support to RTL
        var direction = isRtl() ? ["ArrowLeft", "ArrowRight"] : ["ArrowRight", "ArrowLeft"];
      if (direction.indexOf(e.key) === 0) {
        RootManager.next();
      } else if (direction.indexOf(e.key) === 1) {
        RootManager.back();
      }
    }
  });

  window.addEventListener('localized', () => {
    var rootTab = document.getElementById('root-tab');
    rootTab.select(rootTab.selected);
  });
  exports.RootManager = RootManager;
})(this);
