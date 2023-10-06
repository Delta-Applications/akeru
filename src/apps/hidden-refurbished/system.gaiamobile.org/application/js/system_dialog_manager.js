'use strict';(function(exports){var DEBUG=false;var SystemDialogManager=function SystemDialogManager(){this.init();};SystemDialogManager.prototype={elements:{windows:null,screen:null,containerElement:document.getElementById('dialog-overlay')},states:{activeDialog:null,runningDialogs:{}},configs:{listens:['system-dialog-created','system-dialog-show','system-dialog-hide','system-dialog-requestfocus','home','holdhome','launchapp','hierarchytopmostwindowchanged']}};SystemDialogManager.prototype.isActive=function(){return!!this.states.activeDialog;};SystemDialogManager.prototype.setHierarchy=function(active){if(!this.states.activeDialog){return;}
if(active){this.states.activeDialog.focus();}
this.states.activeDialog._setVisibleForScreenReader(active);};SystemDialogManager.prototype.name='SystemDialogManager';SystemDialogManager.prototype.EVENT_PREFIX='systemdialogmanager';SystemDialogManager.prototype.publish=function(evtName){this.debug('publishing '+evtName);window.dispatchEvent(new CustomEvent(this.EVENT_PREFIX+evtName,{detail:this}));};SystemDialogManager.prototype['_handle_system-resize']=function(){if(this.states.activeDialog){this.states.activeDialog.resize();return false;}
return true;};SystemDialogManager.prototype._handle_mozChromeEvent=function(evt){if(!this.states.activeDialog||!evt.detail||evt.detail.type!=='inputmethod-contextchange'){return true;}
var typesToHandle=['select-one','select-multiple','date','time','datetime','datetime-local','blur'];if(typesToHandle.indexOf(evt.detail.inputType)<0){return true;}
this.states.activeDialog.broadcast('inputmethod-contextchange',evt.detail);return false;};SystemDialogManager.prototype._handle_home=function(evt){if(this.states.activeDialog){this.deactivateDialog(this.states.activeDialog,evt.type);}
return true;};SystemDialogManager.prototype._handle_holdhome=function(evt){if(this.states.activeDialog){this.deactivateDialog(this.states.activeDialog,evt.type);}
return true;};SystemDialogManager.prototype.respondToHierarchyEvent=function(evt){if(this['_handle_'+evt.type]){return this['_handle_'+evt.type](evt);}
return true;};SystemDialogManager.prototype.handleEvent=function sdm_handleEvent(evt){var dialog=null;switch(evt.type){case'hierarchytopmostwindowchanged':var appWindow=evt.detail.getTopMostWindow();var isFullScreen=appWindow&&appWindow.isFullScreen();var container=this.elements.containerElement;container.classList.toggle('fullscreen',isFullScreen);if(this.states.activeDialog){this.states.activeDialog.resize();}
break;case'system-dialog-requestfocus':if(evt.detail!==this.states.activeDialog){return;}
Service.request('focus',this);break;case'system-dialog-created':dialog=evt.detail;this.registerDialog(dialog);break;case'system-dialog-show':dialog=evt.detail;this.activateDialog(dialog);break;case'system-dialog-hide':dialog=evt.detail;this.deactivateDialog(dialog);break;case'launchapp':if(evt.detail&&evt.detail.stayBackground){return;}
if(this.states.activeDialog){this.deactivateDialog(this.states.activeDialog,evt.type);}
break;}};SystemDialogManager.prototype.init=function sdm_init(){this.initElements();this.start();this.debug('init:');};SystemDialogManager.prototype.initElements=function sdm_initElements(){var selectors={windows:'windows',screen:'screen',containerElement:'dialog-overlay'};for(var name in selectors){var id=selectors[name];this.elements[name]=document.getElementById(id);}};SystemDialogManager.prototype.start=function sdm_start(){this.configs.listens.forEach((function _initEvent(type){self.addEventListener(type,this);}).bind(this));Service.request('registerHierarchy',this);};SystemDialogManager.prototype.registerDialog=function sdm_registerDialog(dialog){this.states.runningDialogs[dialog.instanceID]=dialog;};SystemDialogManager.prototype.unregisterDialog=function sdm_unregisterDialog(dialog){delete this.states.runningDialogs[dialog.instanceID];};SystemDialogManager.prototype.activateDialog=function sdm_activateDialog(dialog){this.debug('activateDialog: dialog.instanceID = '+dialog.instanceID);if(this.states.activeDialog&&dialog.instanceID!=this.states.activeDialog.instanceID){this.states.activeDialog.hide('interrupted',true);}
this.states.activeDialog=dialog;if(!this.elements.screen.classList.contains('dialog')){this.elements.screen.classList.add('dialog');this.publish('-activated');}};SystemDialogManager.prototype.deactivateDialog=function sdm_deactivateDialog(dialog,reason){this.debug('deactivateDialog: dialog.instanceID = '+dialog.instanceID);if(this.states.activeDialog&&dialog.instanceID==this.states.activeDialog.instanceID){if(reason){this.states.activeDialog.hide(reason,true);}else{}
this.elements.screen.classList.remove('dialog');this.states.activeDialog=null;this.publish('-deactivated');}else{}};SystemDialogManager.prototype.debug=function sd_debug(){if(DEBUG){console.log('[SystemDialogManager]'+'['+Service.currentTime()+']'+'['+Array.slice(arguments).concat()+']');}};exports.SystemDialogManager=SystemDialogManager;}(window));