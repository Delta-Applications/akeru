'use strict';var FtuLauncher={name:'FtuLauncher',_ftu:null,_ftuManifestURL:'',_ftuOrigin:'',_isRunningFirstTime:false,_isUpgrading:false,_bypassHomeEvent:false,isFtuRunning:function fl_isFtuRunning(){return this._isRunningFirstTime;},isFtuUpgrading:function fl_isFtuUpgrading(){return this._isUpgrading;},getFtuOrigin:function fl_getFtuOrigin(){return this._ftuOrigin;},setBypassHome:function fl_setBypassHome(value){this._bypassHomeEvent=value;},init:function fl_init(){window.addEventListener('iac-ftucomms',this);window.addEventListener('appterminated',this);window.addEventListener('lockscreen-appopened',this);window.addEventListener('appopened',this);Service.registerState('isFtuUpgrading',this);Service.registerState('isFtuRunning',this);Service.register('shouldSkip',this);},_handle_home:function(evt){if(this._isRunningFirstTime){if((Service.query('getTopMostWindow').isActivity&&evt.detail&&evt.detail.back)||Service.query('getTopMostWindow').isBrowser()){return true;}
if(!this._bypassHomeEvent){return false;}else{var killEvent=document.createEvent('CustomEvent');killEvent.initCustomEvent('killapp',true,false,{origin:this._ftuOrigin});window.dispatchEvent(killEvent);}}
return true;},_handle_holdhome:function(){if(this._isRunningFirstTime){return false;}
return true;},respondToHierarchyEvent:function(evt){if(this['_handle_'+evt.type]){return this['_handle_'+evt.type](evt);}
return true;},handleEvent:function fl_init(evt){switch(evt.type){case'appopened':if(evt.detail.origin==this._ftuOrigin&&this._isRunningFirstTime){var ftuopenEvt=document.createEvent('CustomEvent');ftuopenEvt.initCustomEvent('ftuopen',true,false,{});window.dispatchEvent(ftuopenEvt);}
break;case'iac-ftucomms':var message=evt.detail;if(message==='done'){this.setBypassHome(true);}
break;case'appterminated':if(evt.detail.origin==this._ftuOrigin){this.close();}
break;}},close:function fl_close(){this._isRunningFirstTime=false;this._isUpgrading=false;window.asyncStorage.setItem('ftu.enabled',false);if(this._ftu.manifest.versionCode){window.asyncStorage.setItem('ftu.version',this._ftu.manifest.versionCode);}
VersionHelper.updatePrevious();var evt=document.createEvent('CustomEvent');evt.initCustomEvent('ftudone',true,false,{});window.dispatchEvent(evt);window.ftu_finished=true;},shouldSkip:function fl_shouldSkip(){const self=this;return new Promise((resolve)=>{self.resolve=resolve;self._ftuFetch().then((hasFTU)=>{if(!hasFTU){resolve();self.resolve=null;}});});},launch:function fl_launch(){const self=this;self._ftuFetch().then((hasFTU)=>{window.ftu_finished=false;if(!hasFTU){self.skip();window.ftu_finished=true;return;}
if(!self._isUpgrading){self._isRunningFirstTime=true;self._ftu.launch();return;}
window.asyncStorage.getItem('ftu.version',function getItem(version){if(self._ftu.manifest.versionCode&&version!==self._ftu.manifest.versionCode){self._isRunningFirstTime=true;self._ftu.launch();}else{self.skip();window.ftu_finished=true;}});});},_ftuFetch:function(){const self=this;if(self._hasFTU!==undefined){return Promise.resolve(self._hasFTU);}
return new Promise((resolve)=>{var lock=navigator.mozSettings.createLock();var req=lock.get('ftu.manifestURL');req.onsuccess=function(){self.manifestURL=req.result['ftu.manifestURL'];self._ftu=applications.getByManifestURL(self.manifestURL);self._ftuOrigin=self._ftu?self._ftu.origin:self._ftuOrigin;self._hasFTU=!!self._ftu;if(!self._hasFTU){dump('Could not have FTU: manifestURL:'+self.manifestURL+', _ftu:'+self._ftu+'\n');}
resolve(self._hasFTU);};req.onerror=function(){dump('Couldn\'t get the ftu manifestURL.\n');self._hasFTU=false;resolve(self._hasFTU);};if(lock.forceClose){lock.forceClose();}});},skip:function fl_skip(){this._isRunningFirstTime=false;this._isUpgrading=false;var evt=document.createEvent('CustomEvent');evt.initCustomEvent('ftuskip',true,false,{});window.dispatchEvent(evt);this.resolve&&this.resolve();this.resolve=null;},retrieve:function fl_retrieve(){var self=this;VersionHelper.getVersionInfo().then(function(versionInfo){if(versionInfo.isUpgrade()){self._isUpgrading=true;self.launch();}else{window.asyncStorage.getItem('ftu.enabled',function getItem(shouldFTU){self._isUpgrading=false;if(shouldFTU!==false){self.launch();}else{self._isUpgrading=true;self.launch();}});}},function(){dump('VersionHelper failed to lookup version settings, skipping.\n');self.skip();});}};FtuLauncher.init();