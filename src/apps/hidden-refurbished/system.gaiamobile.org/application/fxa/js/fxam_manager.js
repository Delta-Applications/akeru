'use strict';var FxaModuleManager={paramsRetrieved:null,init:function fxamm_init(){var hash=window.location.hash.split('?');var flow=hash[0].replace('#','');if(hash.length>1){var queryParams=hash[1].split('&');for(var i=0;i<queryParams.length;i++){var param=queryParams[i].split('=');if(param.length!=2){console.warning('Wrong query parameter');continue;}
this.setParam(param[0],param[1]);}}
FxaModuleUI.init(flow);},setParam:function fxamm_setParam(key,value){if(!this.paramsRetrieved){this.paramsRetrieved={};}
this.paramsRetrieved[key]=value;},done:function fxamm_done(){window.parent.FxAccountsUI.done(FxaModuleManager.paramsRetrieved);},close:function fxamm_close(error){if(!this.paramsRetrieved||!this.paramsRetrieved.done){window.parent.FxAccountsUI.error(error);return;}
window.parent.FxAccountsUI.done(this.paramsRetrieved);}};window.addEventListener('load',function managerLoaded(){window.removeEventListener('load',managerLoaded);FxaModuleManager.init();});