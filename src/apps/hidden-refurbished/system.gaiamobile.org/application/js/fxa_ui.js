'use strict';var FxAccountsUI={dialog:null,panel:null,iframe:null,onerrorCb:null,onsuccessCb:null,isClosing:false,init:function init(){var dialogOptions={onHide:this.reset.bind(this)};if(!this.dialog){this.dialog=new FxAccountsDialog(dialogOptions);}
this.panel=this.dialog.getView();this.iframe=document.createElement('iframe');this.iframe.id='fxa-iframe';},login:function fxa_ui_login(onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('login');},checkPassword:function fxa_ui_checkPassword(email,title,onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('checkPassword',['email='+email,'title='+title]);},changePassword:function fxa_ui_changePassword(email,onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('changePassword',['email='+email]);},signOut:function fxa_ui_signOut(email,onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('signOut',['email='+email]);},phoneVerification:function(onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('phoneVerification');},createAccount:function fxa_ui_createAccount(onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('createAccount');},logout:function fxa_ui_logout(onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('logout');},delete:function fxa_ui_delete(onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('delete');},refreshAuthentication:function fxa_ui_refreshAuth(email,onsuccess,onerror){this.onsuccessCb=onsuccess;this.onerrorCb=onerror;this.loadFlow('refresh_auth',['email='+email]);},fillInOTP:function(otp){if(this.iframe&&this.iframe.contentWindow&&this.iframe.contentWindow.FxaModuleEnterOTP){this.iframe.contentWindow.FxaModuleEnterOTP.onOTPReceived(otp);}},close:function fxa_ui_close(){var onTransitionEnd=function onClosedAnimation(){this.panel.removeEventListener('animationend',onTransitionEnd,false);this.panel.classList.remove('closing');this.sendCloseMsg();this.dialog.hide();}.bind(this);this.panel.addEventListener('animationend',onTransitionEnd);this.isClosing=true;this.panel.classList.add('closing');},sendCloseMsg:function fxa_ui_sendCloseMsg(){var fxaApps=['app://ftu.gaiamobile.org','app://settings.gaiamobile.org'];fxaApps.forEach(function(origin){if(window.appWindowManager.getApp(origin)){navigator.mozApps.getSelf().onsuccess=function(){var app=this.result;app.connect('system-dialog-close_'+origin).then(function(ports){ports.forEach(function(port){port.postMessage({});});},function _onConnectReject(data){console.warn('Connection reject'+data);});};}});},reset:function fxa_ui_reset(reason){this.panel.removeChild(this.iframe);this.dialog.browser=null;if(reason=='home'||reason=='holdhome'){this.onerrorCb&&this.onerrorCb('DIALOG_CLOSED_BY_USER');}
this.onerrorCb=null;this.onsuccessCb=null;this.isClosing=false;},loadFlow:function fxa_ui_loadFlow(flow,params){var url='../fxa/fxa_module.html#'+flow;if(FtuLauncher.isFtuRunning()){params=params||[];params.push('isftu=true');}
if(params&&Array.isArray(params)){url+='?'+params.join('&');}
this.iframe.setAttribute('src',url);this.panel.appendChild(this.iframe);this.dialog.browser={element:this.iframe};this.dialog.show();},done:function fxa_ui_done(data){this.onsuccessCb&&this.onsuccessCb(data);this.close();},error:function fxa_ui_error(error){this.onerrorCb&&this.onerrorCb(error);this.close();}};navigator.mozL10n.once(FxAccountsUI.init.bind(FxAccountsUI));