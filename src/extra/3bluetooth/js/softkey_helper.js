window.SoftkeyHelper={softkey:null,softkeyItems:null,init(){this.softkeyItems={"enable-bluetooth-view":[{l10nId:"cancel",priority:1,method(){Transfer.cancelEnableBluetooth()}},{l10nId:"turn-on",priority:3,method(){Transfer.turnOnBluetooth()}}],"dm-enable-bluetooth-view":[{l10nId:"cancel",priority:1,method(){Transfer.cancelEnableBluetooth()}}],"devices-list-view":[{name:"select",l10nId:"select",priority:2,method(){var e=NavigationMap.focusedElement;Transfer.itemClickHandle(e)}}],"search-devices-list-view":[{name:"select",l10nId:"select",priority:2,method(){var e=NavigationMap.focusedElement;Transfer.itemClickHandle(e)}}],"search-devices-list-view-rescan":[{name:"select",l10nId:"select",priority:2,method(){var e=NavigationMap.focusedElement;Transfer.itemClickHandle(e)}},{l10nId:"rescan",priority:3,method(){Transfer.startSearch()}}]}},create(e){e&&0!==e.length?(e={header:"App Header",items:e},this.softkey?this.softkey.initSoftKeyPanel(e):this.softkey=new SoftkeyPanel(e),this.softkey.show()):this.softkey&&this.softkey.hide()},hide(){this.softkey&&this.softkey.hide()},menuVisible(){return!!this.softkey&&this.softkey.menuVisible},backKeyHandler(){this.showingMenu||ViewHelper.back&&ViewHelper.back()},dirKeyHandler(e){ViewHelper.dirChange&&ViewHelper.dirChange(ViewHelper,e)},endKeyHandler(){window.close()},defaultBackHandler(e){null===e&&(e=ViewHelper.curViewId),delete NavigationMap.focusedControls[e]}};