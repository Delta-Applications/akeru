const ViewHelper={curView:null,back:null,controls:null,focus:null,defaultFocusIndex:0,navigator:null,selector:null,dirChange:null,get curViewId(){let e=null;var t;return this.curView&&(e=this.curView.id,(t=this.curView.dataset.subid)&&0<t.length&&(e+=`.${t}`)),e},setDefault(){this.curView=null,this.back=SoftkeyHelper.defaultBackHandler,this.controls=this.defaultGetControls.bind(this),this.focus=NavigationMap.getDefaultFocusIndex,this.focusChange=null,this.defaultFocusIndex=0,this.navigator=VerticalNavigator,this.selector="div > ul:not([hidden]) > li:not([hidden]):not(.nofocus):not(.hidden)",this.dirChange=null},defaultGetControls(){let e=null;return this.curView&&this.selector&&(e=this.curView.querySelectorAll(this.selector)),e},switchView(e,t){switch(this.setDefault(),this.curView=document.getElementById(e),e){case"enable-bluetooth-view":case"devices-list-view":this.back=()=>{Transfer.cancelEnableBluetooth()};break;case"search-devices-list-view":this.back=()=>{Transfer.backToDeviceView()}}NavigationMap.reset(t)},init(){SoftkeyHelper.init();const e=new MutationObserver(e=>{e.forEach(e=>{const{target:t}=e,i=t.classList;"attributes"===e.type&&"class"===e.attributeName&&("enable-bluetooth-view"!==t.id&&"FORM"!==t.nodeName||"dialog"!==t.getAttribute("role")||!i.contains("current")?"SECTION"===t.nodeName&&"region"===t.getAttribute("role")&&i.contains("current")&&(t.getAttribute("hidden")||ViewHelper.switchView(t.id,NAV_TYPE.view)):t.getAttribute("hidden")||ViewHelper.switchView(t.id,NAV_TYPE.dialog))})});e.observe(document.body,{childList:!0,attributes:!0,subtree:!0})}};