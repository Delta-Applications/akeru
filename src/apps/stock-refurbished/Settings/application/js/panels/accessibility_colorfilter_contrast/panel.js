define(["require","modules/settings_panel","shared/settings_listener"],function(e){var t=e("modules/settings_panel"),n=e("shared/settings_listener");return function(){var e=0,i={},o={menuClassName:"menu-button",header:{l10nId:"message"},items:[{name:"Save",l10nId:"save",priority:2,method:function(){var e=i.progress.value;e=r(2*e-1,1),a(e)}}]},r=function(e,t){return Math.round(e*Math.pow(10,t))/Math.pow(10,t)},a=function(t){if(!(isNaN(t)||t>1||-1>t)){var n=navigator.mozSettings.createLock(),i=n.set({"accessibility.colors.contrast":t});i.onsuccess=function(){e!==t&&showToast("changessaved"),Settings.currentPanel="#accessibility"}}};return t({onInit:function(e){i.panel=e,i.progressDesc=e.querySelector(".progress-desc"),i.progress=e.querySelector("#contrast-progress"),this._current=0,this.handleKeydown=this._handleKeyDown.bind(this)},onBeforeShow:function(t){SettingsSoftkey.init(o),ListFocusHelper.updateSoftkey(t),n.observe("accessibility.colors.contrast",0,function(t){var t=r(t,1);this._current=10*t,e=t,this._setProgress(t)}.bind(this))},onShow:function(){window.addEventListener("keydown",this.handleKeydown)},onBeforeHide:function(){window.removeEventListener("keydown",this.handleKeydown)},_setProgress:function(e){e=r((1+e)/2,2),i.progress.value=e,i.progressDesc.textContent=r(100*e,0)+"%"},_handleKeyDown:function(e){switch(e.key){case"ArrowDown":this._current>-10&&(this._current=this._current-1);break;case"ArrowUp":this._current<10&&(this._current+=1)}this._setProgress(r(this._current/10,1))}})}});