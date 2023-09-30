'use strict';(function(exports){let Stores=function(){this.DEBUG=true;this.name='Store';this.items=[];this.map=new Map();this.storeName='WEA';this.cacheItems=[];this.cacheMap=new Map();this.cacheStoreName='CACHE_WEA';};Stores.prototype.debug=function(s){if(this.DEBUG){console.log(`-*- CMAS ${this.name} -*- ${s}`);}};Stores.prototype.init=function(){let data=window.localStorage.getItem(this.storeName);if(data){this.items=JSON.parse(data);this.items.forEach((item)=>{this.map.set(item.id,item);});}
let cacheData=window.localStorage.getItem(this.cacheStoreName);if(cacheData){const currentTime=new Date().getTime();JSON.parse(cacheData).forEach((item)=>{if(Math.abs(item.timestamp-currentTime)<=Utils.expireTime){this.cacheItems.push(item);this.cacheMap.set(item.id,item);}});}};Stores.prototype.getItem=function(id){return new Promise((resolve)=>{if(this.map.get(+id)){resolve(this.map.get(+id));}else{resolve();}});};Stores.prototype.getAll=function(){return this.map;};Stores.prototype.save=function(message){message.id=new Date().getTime();this.map.set(message.id,message);this.cacheMap.set(message.id,message);this.write();};Stores.prototype.remove=function(id){let item=this.map.get(+id);if(!item){return;}
this.map.delete(+id);this.write();};Stores.prototype.write=function(){this.items=[...this.map.values()];if(this.items.length>0){this.cacheItems=[...this.cacheMap.values()];try{window.localStorage.setItem(this.cacheStoreName,JSON.stringify(this.cacheItems));window.localStorage.setItem(this.storeName,JSON.stringify(this.items));}catch(e){this.debug(`localStorage execute setItem operate occur exception.`);}}else{window.localStorage.removeItem(this.storeName);}};Stores.prototype.getActiveMessages=function(message){let result={gsmMsgArr:[],cdmaMsgArr:[]};this.cacheItems.forEach((item)=>{if(Math.abs(item.timestamp-message.timestamp)<=Utils.expireTime){if(item.isGSM){result.gsmMsgArr.push(item);}else{result.cdmaMsgArr.push(item);}}});return result;};exports.Store=new Stores();})(window);