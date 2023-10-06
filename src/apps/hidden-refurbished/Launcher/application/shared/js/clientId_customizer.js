'use strict';(function(exports){const CUSTOMIZED_PROVIDER_NAME='google';const GOOGLE_CLIENT_ID_KEY='google.client_id';const CLIENT_REGEXP='client=';var googleClientId=null;var DEBUG=false;function debug(msg){if(DEBUG){console.log('--> ClientIdCustomizer(): '+msg);}}
function ClientIdCustomizer(){this.getGoogleClientId();}
ClientIdCustomizer.prototype={getGoogleClientId:function(){navigator.mozSettings.createLock().get(GOOGLE_CLIENT_ID_KEY).then(result=>{var customizedId=result[GOOGLE_CLIENT_ID_KEY];if(customizedId&&(customizedId!=='')){googleClientId=customizedId;debug('customized google client id to be = '+googleClientId);}});},parse:function(searchUrl){if(!googleClientId){return searchUrl;}
if(searchUrl.indexOf(CUSTOMIZED_PROVIDER_NAME)<0){return searchUrl;}
if(searchUrl.indexOf(CLIENT_REGEXP)<0){return searchUrl;}
let newUrl=searchUrl.slice(0,searchUrl.indexOf(CLIENT_REGEXP)+CLIENT_REGEXP.length)+
googleClientId;debug('newUrl = '+newUrl);return newUrl;}};exports.ClientIdCustomizer=new ClientIdCustomizer();}(window));