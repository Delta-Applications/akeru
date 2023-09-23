/* globals NavigationManager, DUMP */
const NavigationMap = {
  currentActivatedLength: 0,
  init() {
    DUMP('NavigationMap Init (CallScreen)');
    document.addEventListener('menuEvent', (e) => {
      NavigationMap.menuIsActive = e.detail.menuVisible;
      if (e.detail.menuVisible) {
        NavigationManager.reset('.menu-button');
      }
    });
  }
};
window.NavigationMap = NavigationMap;
