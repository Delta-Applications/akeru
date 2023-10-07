'use strict';(function(window){var WrapperFactory={init:function wf_init(){window.addEventListener('mozbrowseropenwindow',this,true);},uninit:function(){window.removeEventListener('mozbrowseropenwindow',this,true);},isLaunchingWindow:function(){return!!this._launchingApp;},forgetLastLaunchingWindow:function(){if(this._launchingApp&&this._launchingApp.element){this._launchingApp.element.removeEventListener('_opened',this);this._launchingApp.element.removeEventListener('_terminated',this);}
this._launchingApp=null;},handleEvent:function wf_handleEvent(evt){if(evt.type==='_opened'||evt.type==='_terminated'){if(this._launchingApp===evt.detail){this.forgetLastLaunchingWindow();}
return;}
var detail=evt.detail;if(typeof detail.features!=='string'){return;}
var features=detail.features.split(',').reduce(function(acc,feature){feature=feature.split('=').map(function(featureElem){return featureElem.trim();});if(feature.length!==2){return acc;}
acc[decodeURIComponent(feature[0])]=decodeURIComponent(feature[1]);return acc;},{});if(!('remote'in features)||features.remote!=='true'){return;}
var callerOrigin;if(evt.target!==window){var callerIframe=evt.target;var manifestURL=callerIframe.getAttribute('mozapp');var callerApp=applications.getByManifestURL(manifestURL);if(!this.hasPermission(callerApp,'open-remote-window')){return;}
callerOrigin=callerApp.origin;}else{callerOrigin=location.origin;}
evt.stopImmediatePropagation();var name=detail.name;var url=detail.url;var app;var origin=null;if(name=='_blank'){var activeApp=Service.currentApp;var isSearchApp=(activeApp.manifest&&activeApp.manifest.role==='search');if(activeApp&&(activeApp.isBrowser()||isSearchApp)){activeApp.navigate(url);return;}
origin=url;app=appWindowManager.getApp(origin);if(app&&app.windowName=='_blank'){this.publish('launchapp',{origin:origin});}}else{origin='window:'+name+',source:'+callerOrigin;app=appWindowManager.getApp(origin);if(app&&app.windowName===name){if(app.iframe.src===url){this.publish('launchapp',{origin:origin});return;}else{this.publish('killapp',{origin:origin});}}}
var browser_config=this.generateBrowserConfig(features);browser_config.url=url;browser_config.origin=origin;browser_config.windowName=name;if(!browser_config.title){browser_config.title=url;}
this.launchWrapper(browser_config);},launchWrapper:function wf_launchWrapper(config){var app=appWindowManager.getApp(config.origin);if(!app){config.chrome={scrollable:true};this.forgetLastLaunchingWindow();this.trackLaunchingWindow(config);}else{app.updateName(config.title);}
this.publish('launchapp',{origin:config.origin});},trackLaunchingWindow:function(config){this._launchingApp=new AppWindow(config);this._launchingApp.element.addEventListener('_opened',this);this._launchingApp.element.addEventListener('_terminated',this);},hasPermission:function wf_hasPermission(app,permission){var mozPerms=navigator.mozPermissionSettings;if(!mozPerms){return false;}
var value=mozPerms.get(permission,app.manifestURL,app.origin,false);return(value==='allow');},generateBrowserConfig:function wf_generateBrowserConfig(features){var config={};config.title=features.name;config.icon=features.icon||'';if('originName'in features){config.originName=features.originName;config.originURL=features.originUrl;}
if('searchName'in features){config.searchName=features.searchName;config.searchURL=features.searchUrl;}
if('remote'in features){config.oop=true;}
return config;},publish:function wf_publish(event,detail){var evt=new CustomEvent(event,{detail:detail});window.dispatchEvent(evt);}};window.WrapperFactory=WrapperFactory;WrapperFactory.init();}(window));