
(function(){'use strict';function dump_off(msg,optionalObject){}
function dump_on(msg,optionalObject){var output=msg;if(optionalObject){output+=JSON.stringify(optionalObject);}
if(dump){var appName=document.location.hostname.replace(/\..*$/,'');dump('['+appName+'] '+output+'\n');}else{console.log(output);}}
window.DUMP=dump_off;var settings=window.navigator.mozSettings;var reqGaiaDebug=settings.createLock().get('debug.gaia.enabled');reqGaiaDebug.onsuccess=function gaiaDebug(){window.DUMP=reqGaiaDebug.result['debug.gaia.enabled']?dump_on:dump_off;};settings.addObserver('debug.gaia.enabled',function(event){window.DUMP=event.settingValue?dump_on:dump_off;dump_on(event.settingValue?'Enabling DUMP':'Disabling DUMP');});}());