'use strict';var Antitheft_Requester={XHR_TIMEOUT_MS:10000,_hawkCredentials:null,setHawkCredentials:function at_setHawkCredentials(id,key){this._hawkCredentials={id:id,key:key,algorithm:'sha256'};},setHawk:function at_setHawk(assertion){var assertobj=JSON.parse(assertion);var key_str=this.safeAtoB(assertobj.mac_key);var buffer=new ArrayBuffer(key_str.length);var ubuffer=new Uint8Array(buffer);for(var i=0;i<ubuffer.length;i++){ubuffer[i]=key_str.charCodeAt(i);}
var mac_key_hex=this.toHexString(ubuffer);console.log('antitheft_requester mac_key_hex is '+mac_key_hex);this.setHawkCredentials(assertobj.kid,mac_key_hex);},toHexString:function at_toHexString(uint8arr){if(!uint8arr){return'';}
var hexStr='';for(var i=0;i<uint8arr.length;i++){var hex=(uint8arr[i]&0xff).toString(16);hex=(hex.length===1)?'0'+hex:hex;hexStr+=hex;}
return hexStr.toUpperCase();},safeAtoB:function at_safeAtoB(str){let len=str.length;let over=len%4;return over?atob(str.substr(0,len-over)):atob(str);},makeRequest:function at_makeRequest(options){return new Promise((resolve,reject)=>{var hawkHeader=null;var params=options.params;var method=options.method;var authorization=options.authorization;var url=options.url;var xhr=new XMLHttpRequest({mozSystem:true});xhr.open(method,url,true);xhr.timeout=this.XHR_TIMEOUT_MS;xhr.setRequestHeader('Content-Type','application/json');xhr.withCredentials=true;xhr.responseType='';if(authorization){xhr.setRequestHeader('Authorization',authorization);}else if(this._hawkCredentials){hawkHeader=hawk.client.header(url,method,{credentials:this._hawkCredentials,contentType:'application/json',payload:params});xhr.setRequestHeader('Authorization',hawkHeader.field);}
xhr.onload=function fmdr_xhr_onload(){if(this.status>=200&&this.status<300){var ret='';try{ret=JSON.parse(xhr.response);}catch(e){}
resolve(ret);}else{reject({status:this.status,statusText:xhr.statusText,responseText:xhr.responseText});}};xhr.onerror=function fmd_xhr_onerror(){reject({status:xhr.status,statusText:xhr.statusText,responseText:xhr.responseText});};xhr.ontimeout=function fmd_xhr_ontimeout(){xhr.onerror();};if(params){xhr.send(params);}else{xhr.send();}});}};