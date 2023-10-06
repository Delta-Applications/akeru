'use strict';(function(exports){function AppWindowFactory(){this.preHandleEvent=this.preHandleEvent.bind(this);}
AppWindowFactory.prototype={_started:false,_queueApps:[],start:function awf_start(){if(this._started){return;}
this._started=true;window.addEventListener('webapps-launch',this.preHandleEvent);window.addEventListener('webapps-close',this.preHandleEvent);window.addEventListener('open-app',this.preHandleEvent);window.addEventListener('openwindow',this.preHandleEvent);window.addEventListener('appopenwindow',this.preHandleEvent);window.addEventListener('appclosed',this.preHandleEvent);window.addEventListener('applicationready',(function appReady(){window.removeEventListener('applicationready',appReady);this._handlePendingEvents();}).bind(this));},stop:function awf_stop(){if(!this._started){return;}
this._started=false;window.removeEventListener('webapps-launch',this.preHandleEvent);window.removeEventListener('webapps-close',this.preHandleEvent);window.removeEventListener('open-app',this.preHandleEvent);window.removeEventListener('openwindow',this.preHandleEvent);window.removeEventListener('appopenwindow',this.preHandleEvent);window.removeEventListener('appclosed',this.preHandleEvent);},_queueEvents:[],_queuePendingEvent:function(evt){this._queueEvents.push(evt);},_handlePendingEvents:function(){this._queueEvents.forEach((function(evt){this.handleEvent(evt);}).bind(this));this._queueEvents=[];},preHandleEvent:function(evt){if(applications.ready){this.handleEvent(evt);}else{this._queuePendingEvent(evt);}},handleEvent:function awf_handleEvent(evt){var detail=evt.detail;if(evt.type==='_opened'||evt.type==='_terminated'||evt.type==='appclosed'){if(this._launchingApp===detail){this.forgetLastLaunchingWindow();}
return;}
if(!detail.url&&!detail.manifestURL){return;}
var config=new BrowserConfigHelper(detail,evt.type);if(config.homepageUrl){new MozActivity({name:'view',data:{type:'url',url:config.homepageUrl}});return;}
config.evtType=evt.type;if(detail.extra&&detail.extra.isPaymentRequest){if(detail.extra.manifestURL){config.parentApp=detail.extra.manifestURL;}
if(detail.extra.pageURL){config.parentAppPageURL=detail.extra.pageURL;}
this.publish('launchpayment',config);return;}
switch(evt.type){case'openwindow':case'appopenwindow':case'webapps-launch':config.timestamp=detail.timestamp;this.launch(config);break;case'open-app':config.isSystemMessage=true;if(detail.isActivity){config.isActivity=true;if(detail.target.disposition&&detail.target.disposition=='inline'){config.inline=true;}}
config.changeURL=!detail.onlyShowApp;config.stayBackground=!detail.showApp;if(detail.extra){if(detail.extra.manifestURL){config.parentApp=detail.extra.manifestURL;}
if(detail.extra.pageURL){config.parentAppPageURL=detail.extra.pageURL;}}
this.launch(config);break;case'webapps-close':this.publish('killapp',config);break;}},launch:function awf_launch(config){if(config.url===window.location.href){return;}
if(attentionWindowManager){let attentionWindow=attentionWindowManager.getActiveWindow();if(attentionWindow&&!config.stayBackground&&config.parentApp!==attentionWindow.manifestURL){console.log('Attention window is active so do not launch foreground app window');return;}}
if(config.isActivity&&config.inline){this.publish('launchactivity',config);return;}
if(this._isSearch(config)){if(config.url.indexOf('newtab.html')===-1){return;}
let openInstance=this._findBrowserInstance(config);if(openInstance){openInstance.requestOpen();return;}}
var app=window.appWindowManager.getApp(config.origin,config.manifestURL);if(app){if(this.checkBusyLaunching(config)){return;}
if(config.evtType=='appopenwindow'){app.browser.element.src=config.url;}
app.reviveBrowser();}else{this.forgetLastLaunchingWindow();this.trackLaunchingWindow(config);}
this.publish('launchapp',config);},checkBusyLaunching:function(config){if(config.stayBackground){return false;}
if(this._launchingApp||this.isLaunchingAppRecently){console.error('cannot open ',config,' because still launching app',this._launchingApp);this.addToAppQueue(config);return true;}
this.isLaunchingAppRecently=true;this.recentLaunchingAppTimer=setTimeout(()=>{this.isLaunchingAppRecently=false;},1000);return false;},processAppQueue:function(){let length=this._queueApps.length;if(length){if(!this.isLaunchingAppRecently){let appConfig=this._queueApps.pop();if(appConfig){this.launch(appConfig);}}else{setTimeout(()=>{this.processAppQueue();},2000);}}},addToAppQueue:function(config){this._queueApps.push(config);setTimeout(()=>{this.processAppQueue();},2000);},trackLaunchingWindow:function(config){if(this.checkBusyLaunching(config)){return;}
var app=new AppWindow(config);if(config.stayBackground){return;}
this._launchingApp=app;this._launchingApp.element.addEventListener('_opened',this);this._launchingApp.element.addEventListener('_terminated',this);},forgetLastLaunchingWindow:function(){if(this._launchingApp&&this._launchingApp.element){this._launchingApp.element.removeEventListener('_opened',this);this._launchingApp.element.removeEventListener('_terminated',this);}
this._launchingApp=null;},isLaunchingWindow:function(){return!!this._launchingApp;},_findBrowserInstance:function(config){var activeApp=window.appWindowManager.getActiveApp();if(!this._isSearch(config)||activeApp.isBrowser()){return;}
return window.appWindowManager.getBrowserApp(config.origin);},_isSearch:function(config){return(config.manifest&&config.manifest.role==='search');},publish:function awf_publish(event,detail,scope){scope=scope||window;var evt=document.createEvent('CustomEvent');evt.initCustomEvent(event,true,false,detail);scope.dispatchEvent(evt);}};exports.AppWindowFactory=AppWindowFactory;}(window));