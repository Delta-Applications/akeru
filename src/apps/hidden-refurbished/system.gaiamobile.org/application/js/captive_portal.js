'use strict';var CaptivePortal={eventId:null,settings:null,notification:null,notificationPrefix:'captivePortal:',captiveNotification_onClick:null,handleLogin:function cp_handleLogin(id,url){var wifiManager=window.navigator.mozWifiManager;var _=window.navigator.mozL10n.get;var settings=window.navigator.mozSettings;var icon=window.location.protocol+'//'+window.location.hostname+'/style/icons/captivePortal.png';this.eventId=id;var currentNetwork=wifiManager.connection.network;var networkName=(currentNetwork&&currentNetwork.ssid)?currentNetwork.ssid:'';var message=_('captive-wifi-available',{networkName:networkName});this.captiveNotification_onClick=(function(){this.notification.removeEventListener('click',this.captiveNotification_onClick);this.captiveNotification_onClick=null;let activity=this.openCaptivePortalBrowserPage(url);this.notification.close();activity.onerror=function(){console.error('CaptivePortal Activity error: '+this.error);};}).bind(this);var options={body:message,icon:icon,tag:this.notificationPrefix+networkName,mozbehavior:{showOnlyOnce:true}};this.notification=new Notification('',options);this.notification.addEventListener('click',this.captiveNotification_onClick);this.notification.addEventListener('close',(function(){this.notification=null;}).bind(this));},openCaptivePortalBrowserPage:function(url){return new MozActivity({name:'view',data:{type:'url',url:url}});},dismissNotification:function dismissNotification(id){if(id===this.eventId){if(this.notification){if(this.captiveNotification_onClick){this.notification.removeEventListener('click',this.captiveNotification_onClick);this.captiveNotification_onClick=null;}
this.notification.close();}}},handleLoginAbort:function handleLoginAbort(id){this.dismissNotification(id);},handleLoginSuccess:function handleLoginSuccess(id){this.dismissNotification(id);},handleEvent:function cp_handleEvent(evt){switch(evt.detail.type){case'captive-portal-login':Service.request('closeWifiNotificationByTag',Wifi.NO_INTERNET_TAG);this.handleLogin(evt.detail.id,evt.detail.url);this.openCaptivePortalBrowserPage(evt.detail.url);break;case'captive-portal-login-abort':this.handleLoginAbort(evt.detail.id);break;case'captive-portal-login-success':this.handleLoginSuccess(evt.detail.id);break;}},init:function cp_init(){var promise=Notification.get();var prefix=this.notificationPrefix;promise.then(function(notifications){notifications.forEach(function(notification){if(!notification){return;}
if(!notification.tag||!notification.tag.startsWith(prefix)){return;}
notification.close();});}).then((function(){window.addEventListener('mozChromeEvent',this);}).bind(this));return promise;}};if(navigator.mozL10n){navigator.mozL10n.once(CaptivePortal.init.bind(CaptivePortal));}