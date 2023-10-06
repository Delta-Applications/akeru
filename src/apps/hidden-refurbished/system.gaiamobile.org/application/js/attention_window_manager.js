'use strict';(function(exports){var AttentionWindowManager=function(){};AttentionWindowManager.prototype={DEBUG:false,TRACE:false,name:'AttentionWindowManager',_openedInstances:null,EVENT_PREFIX:'attentionwindowmanager',publish:function vm_publish(eventName,detail){this.debug('publishing: ',eventName);var evt=new CustomEvent(this.EVENT_PREFIX+eventName,{detail:detail});window.dispatchEvent(evt);},debug:function aw_debug(){if(this.DEBUG){console.log('['+this.name+']'+'['+Service.currentTime()+'] '+
Array.slice(arguments).concat());if(this.TRACE){console.trace();}}},isActive:function(){return this.hasActiveWindow();},hasActiveWindow:function attwm_hasActiveWindow(){return(this._openedInstances.size!==0);},setHierarchy:function(focus){if(focus){this._topMostWindow&&this._topMostWindow.focus();}},getActiveWindow:function(){return this.getTopMostWindow();},getTopMostWindow:function attwm_getTopMostWindow(){return this._topMostWindow;},respondToHierarchyEvent:function(evt){if(this['_handle_'+evt.type]){return this['_handle_'+evt.type](evt);}else{return true;}},_handle_launchactivity:function(e){if(e.detail.isActivity&&e.detail.inline&&this._topMostWindow){this._topMostWindow.broadcast('launchactivity',e.detail);return false;}
return true;},_handle_home:function(evt){if(!this.hasActiveWindow()){return true;}
if(evt.detail.kill||evt.detail.back){return false;}
this._topMostWindow=null;var nextApp=homescreenLauncher.getHomescreen();if(Service.query('locked')){this.closeAllAttentionWindows();}else if(nextApp&&!nextApp.isDead()){nextApp.ready(this.closeAllAttentionWindows.bind(this));}else{this.closeAllAttentionWindows();}
return true;},'_handle_system-resize':function(){if(this._topMostWindow){this._topMostWindow.resize();return false;}
return true;},_handle_holdhome:function(){if(this.isActive()){this._topMostWindow=null;this.closeAllAttentionWindows();}
return true;},getInstances:function(){return this._instances;},screen:document.getElementById('screen'),start:function attwm_start(){this._instances=[];this._openedInstances=new Map();window.addEventListener('attentioncreated',this);window.addEventListener('attentionterminated',this);window.addEventListener('attentionshown',this);window.addEventListener('attentionopening',this);window.addEventListener('attentionopened',this);window.addEventListener('attentionclosed',this);window.addEventListener('attentionclosing',this);window.addEventListener('attentionrequestopen',this);window.addEventListener('attentionrequestclose',this);window.addEventListener('emergencyalert',this);window.addEventListener('lockscreen-appclosed',this);window.addEventListener('lockscreen-appopened',this);window.addEventListener('secure-appclosed',this);window.addEventListener('secure-appopened',this);window.addEventListener('rocketbar-overlayopened',this);window.addEventListener('languagechange',this);Service.request('registerHierarchy',this);Service.registerState('hasActiveWindow',this);},stop:function attwm_stop(){this._instances=null;this._openedInstances=null;window.removeEventListener('attentioncreated',this);window.removeEventListener('attentionterminated',this);window.removeEventListener('attentionshow',this);window.removeEventListener('attentionopening',this);window.removeEventListener('attentionopened',this);window.removeEventListener('attentionclosed',this);window.removeEventListener('attentionclosing',this);window.removeEventListener('attentionrequestopen',this);window.removeEventListener('attentionrequestclose',this);window.removeEventListener('emergencyalert',this);window.removeEventListener('lockscreen-appclosed',this);window.removeEventListener('lockscreen-appopened',this);window.removeEventListener('secure-appclosed',this);window.removeEventListener('secure-appopened',this);window.removeEventListener('rocketbar-overlayopened',this);window.removeEventListener('languagechange',this);Service.request('unregisterHierarchy',this);},isNetworkAlert:function(app){if(app.origin&&app.origin.indexOf('network-alerts')>=0){return true;}else{return false;}},handleEvent:function attwm_handleEvent(evt){this.debug('handling '+evt.type);var attention=evt.detail;switch(evt.type){case'attentioncreated':this._instances.push(attention);break;case'attentionopening':case'attentionopened':this._openedInstances.set(attention,attention);this.updateAttentionIndicator();this.publish('-activated');this.updateClassState();break;case'attentionrequestclose':window.SettingsListener&&SettingsListener.getSettingsLock().set({'private.broadcast.attention_screen_opening':false});this._openedInstances.delete(attention);if(this._topMostWindow!==attention){attention.close();break;}
var candidate=null;if(this._openedInstances.size===0){this._topMostWindow=null;candidate=Service.currentApp;}else{this._openedInstances.forEach(function(instance){candidate=instance;});this._topMostWindow=candidate;}
var url=this._topMostWindow&&this._topMostWindow.url;if(!url||(!url.startsWith('app://clock.gaiamobile.org')&&!url.startsWith('app://callscreen.gaiamobile.org'))){ScreenManager.setScreenOffMask(true);}
if(!candidate){attention.close();break;}
candidate.ready(function(){attention.close();});break;case'attentionclosing':case'attentionclosed':this._openedInstances.delete(attention);if(this._topMostWindow){this._topMostWindow.promote();this._topMostWindow.setVisible(true);if(Service.query('getTopMostUI')===this){this._topMostWindow.focus();}}
attention.demote();if(this._openedInstances.size===0){this.publish('-deactivated');}
this.updateAttentionIndicator();this.updateClassState();break;case'attentionrequestopen':window.SettingsListener&&SettingsListener.getSettingsLock().set({'private.broadcast.attention_screen_opening':true});this._topMostWindow=attention;var url=this._topMostWindow&&this._topMostWindow.url;if(url&&(url.startsWith('app://clock.gaiamobile.org')||url.startsWith('app://callscreen.gaiamobile.org'))){ScreenManager.setScreenOffMask(false);}
attention.ready(function(){if(document.mozFullScreen){document.mozCancelFullScreen();}
this._openedInstances.forEach(function(opened){if(opened!==attention){opened.demote();opened.setVisible(false);}});attention.promote();attention.setVisible(true);attention.open();}.bind(this));break;case'attentionshown':if(this._instances.indexOf(attention)<0){this._instances.push(attention);}
break;case'attentionterminated':var index=this._instances.indexOf(attention);if(index>=0){this._instances.splice(index,1);}
this._openedInstances.delete(attention);this.updateAttentionIndicator();this.updateClassState();break;case'emergencyalert':case'rocketbar-overlayopened':this._topMostWindow=null;this.closeAllAttentionWindows();break;case'lockscreen-appclosed':case'lockscreen-appopened':case'secure-appopened':case'secure-appclosed':case'languagechange':this._instances.forEach(function(instance){instance.broadcast(evt.type);});break;}},getShownWindowCount:function(){var count=this._instances.length;this._instances.forEach(function(attention){if(attention.isHidden()){count--;}});return count;},updateAttentionIndicator:function(){if(this._openedInstances.size==this.getShownWindowCount()){Service.request('makeAmbientIndicatorInactive');}else{Service.request('makeAmbientIndicatorActive');}},updateClassState:function(){if(this._openedInstances.size!==0){this.screen.classList.add('attention');}else{this.screen.classList.remove('attention');}},closeAllAttentionWindows:function(){this._openedInstances.forEach(function(value){value.close();});}};exports.AttentionWindowManager=AttentionWindowManager;}(window));