'use strict';var MediaDB=(function(){function MediaDB(mediaType,metadataParser,options){this.mediaType=mediaType;this.metadataParser=metadataParser;if(!options){options={};}
this.indexes=options.indexes||[];this.version=options.version||1;this.mimeTypes=options.mimeTypes;this.autoscan=(options.autoscan!==undefined)?options.autoscan:true;this.state=MediaDB.OPENING;this.scanning=false;this.parsingBigFiles=false;this.errorLength=0;this.filesLength=0;this.stopScanning=false;this.updateRecord=options.updateRecord;this.reparsedRecord=options.reparsedRecord;if(options.excludeFilter&&(options.excludeFilter instanceof RegExp)){this.clientExcludeFilter=options.excludeFilter;}
this.batchHoldTime=options.batchHoldTime||100;this.batchSize=options.batchSize||0;this.dbname='MediaDB/'+this.mediaType+'/';var media=this;this.details={eventListeners:{},pendingInsertions:[],pendingDeletions:[],whenDoneProcessing:[],pendingCreateNotifications:[],pendingDeleteNotifications:[],pendingNotificationTimer:null,newestFileModTime:0};if(!this.metadataParser){this.metadataParser=function(file,callback){setTimeout(function(){callback({});},0);};}
var dbVersion=(0xFFFF&this.version)<<16|(0xFFFF&MediaDB.VERSION);var openRequest=indexedDB.open(this.dbname,dbVersion);openRequest.onerror=function(e){dispatchEvent(media,'openMediaDBFail');console.error('MediaDB():',openRequest.error.name);};openRequest.onblocked=function(e){console.error('indexedDB.open() is blocked in MediaDB()');};openRequest.onupgradeneeded=function(e){var db=openRequest.result;var transaction=e.target.transaction;var oldVersion=e.oldVersion;var oldDbVersion=0xFFFF&oldVersion;var oldClientVersion=0xFFFF&(oldVersion>>16);if(oldClientVersion===0){oldDbVersion=2;oldClientVersion=oldVersion/oldDbVersion;}
if(0===db.objectStoreNames.length){createObjectStores(db);}else{handleUpgrade(db,transaction,oldDbVersion,oldClientVersion);}};openRequest.onsuccess=function(e){media.db=openRequest.result;media.db.onerror=function(event){console.error('MediaDB: ',event.target.error&&event.target.error.name);};changeState(media,MediaDB.ENUMERABLE);var cursorRequest=media.db.transaction('files','readonly').objectStore('files').index('date').openCursor(null,'prev');cursorRequest.onerror=function(){console.error('MediaDB initialization error',cursorRequest.error);};cursorRequest.onsuccess=function(){var cursor=cursorRequest.result;if(cursor){media.details.newestFileModTime=cursor.value.date;}
else{media.details.newestFileModTime=0;}
initDeviceStorage();};};function createObjectStores(db){var filestore=db.createObjectStore('files',{keyPath:'name'});filestore.createIndex('date','date');media.indexes.forEach(function(indexName){if(indexName==='name'||indexName==='date'){return;}
filestore.createIndex(indexName,indexName);});}
function enumerateOldFiles(store,callback){var openCursorReq=store.openCursor();openCursorReq.onsuccess=function(){var cursor=openCursorReq.result;if(cursor){callback(cursor.value);cursor.continue();}};}
function handleUpgrade(db,trans,oldDbVersion,oldClientVersion){media.state=MediaDB.UPGRADING;var evtDetail={'oldMediaDBVersion':oldDbVersion,'oldClientVersion':oldClientVersion,'newMediaDBVersion':MediaDB.VERSION,'newClientVersion':media.version};dispatchEvent(media,'upgrading',evtDetail);var store=trans.objectStore('files');if(media.version!=oldClientVersion){upgradeIndexesChanges(store);}
var clientUpgradeNeeded=(media.version!=oldClientVersion)&&media.updateRecord;if((2!=oldDbVersion||3!=MediaDB.VERSION)&&!clientUpgradeNeeded){return;}
enumerateOldFiles(store,function doUpgrade(dbfile){if(2==oldDbVersion&&3==MediaDB.VERSION){upgradeDBVer2to3(store,dbfile);}
if(clientUpgradeNeeded){handleClientUpgrade(store,dbfile,oldClientVersion);}});}
function upgradeIndexesChanges(store){var dbIndexes=store.indexNames;var clientIndexes=media.indexes;for(var i=0;i<dbIndexes.length;i++){if('name'===dbIndexes[i]||'date'===dbIndexes[i]){continue;}
if(clientIndexes.indexOf(dbIndexes[i])<0){store.deleteIndex(dbIndexes[i]);}}
for(i=0;i<clientIndexes.length;i++){if(!dbIndexes.contains(clientIndexes[i])){store.createIndex(clientIndexes[i],clientIndexes[i]);}}}
function upgradeDBVer2to3(store,dbfile){if(dbfile.name[0]==='/'){return;}
store.delete(dbfile.name);dbfile.name='/sdcard/'+dbfile.name;store.add(dbfile);}
function handleClientUpgrade(store,dbfile,oldClientVersion){try{dbfile.metadata=media.updateRecord(dbfile,oldClientVersion,media.version);if(dbfile.needsReparse&&!media.reparsedRecord){console.warn('client app requested reparse, but no reparsedRecord was set');delete dbfile.needsReparse;}
store.put(dbfile);}catch(ex){console.warn('client app updates record, '+dbfile.name+', failed: '+ex.message);}}
function initDeviceStorage(){var details=media.details;details.storages=navigator.getDeviceStorages(mediaType);details.availability={};getStorageAvailability();function getStorageAvailability(){var next=0;getNextAvailability();function getNextAvailability(){if(next>=details.storages.length){setupHandlers();return;}
var s=details.storages[next++];var name=s.storageName;var req=s.available();req.onsuccess=function(e){details.availability[name]=req.result;getNextAvailability();};req.onerror=function(e){details.availability[name]='unavailable';getNextAvailability();};}}
function setupHandlers(){for(var i=0;i<details.storages.length;i++){details.storages[i].addEventListener('change',changeHandler);}
details.dsEventListener=changeHandler;sendInitialEvent();}
function sendInitialEvent(){var state=getState(details.availability);changeState(media,state);if(media.autoscan){scan(media);}}
function getState(availability){var n=0;var a=0;var u=0;var s=0;for(var name in availability){n++;switch(availability[name]){case'available':a++;break;case'unavailable':u++;break;case'shared':s++;break;}}
if(s>0){return MediaDB.UNMOUNTED;}
if(u===n){return MediaDB.NOCARD;}
return MediaDB.READY;}
function changeHandler(e){switch(e.reason){case'modified':case'deleted':fileChangeHandler(e);return;case'available':case'unavailable':case'shared':volumeChangeHandler(e);return;default:return;}}
function volumeChangeHandler(e){var storageName=e.target.storageName;if(details.availability[storageName]===e.reason){return;}
var oldState=media.state;details.availability[storageName]=e.reason;var newState=getState(details.availability);if(newState!==oldState){changeState(media,newState);if(newState===MediaDB.READY){if(media.autoscan){scan(media);}}
else{endscan(media);}}
else if(newState===MediaDB.READY){if(e.reason==='available'){dispatchEvent(media,'ready');if(media.autoscan){scan(media);}}
else if(e.reason==='unavailable'){dispatchEvent(media,'cardremoved');deleteAllFiles(storageName);}}}
function fileChangeHandler(e){var filename=e.path;if(ignoreName(media,filename)){return;}
if(e.reason==='modified'){insertRecord(media,filename);}else{deleteRecord(media,filename);}}
function deleteAllFiles(storageName){var storagePrefix=storageName?'/'+storageName+'/':'';var store=media.db.transaction('files').objectStore('files');var cursorRequest=store.openCursor();cursorRequest.onsuccess=function(){var cursor=cursorRequest.result;if(cursor){if(cursor.value.name.startsWith(storagePrefix)){deleteRecord(media,cursor.value.name);}
cursor.continue();}};}}}
MediaDB.prototype={close:function close(){this.db.close();for(var i=0;i<this.details.storages.length;i++){var s=this.details.storages[i];s.removeEventListener('change',this.details.dsEventListener);}
changeState(this,MediaDB.CLOSED);},addEventListener:function addEventListener(type,listener){if(!this.details.eventListeners.hasOwnProperty(type)){this.details.eventListeners[type]=[];}
var listeners=this.details.eventListeners[type];if(listeners.indexOf(listener)!==-1){return;}
listeners.push(listener);},removeEventListener:function removeEventListener(type,listener){if(!this.details.eventListeners.hasOwnProperty(type)){return;}
var listeners=this.details.eventListeners[type];var position=listeners.indexOf(listener);if(position===-1){return;}
listeners.splice(position,1);},getFileInfo:function getFile(filename,callback,errback){if(this.state===MediaDB.OPENING){throw Error('MediaDB is not ready. State: '+this.state);}
var media=this;var read=media.db.transaction('files','readonly').objectStore('files').get(filename);read.onerror=function(){var msg='MediaDB.getFileInfo: unknown filename: '+filename;if(errback){errback(msg);}else{console.error(msg);}};read.onsuccess=function(){if(callback){callback(read.result);}};},getFile:function getFile(filename,callback,errback){if(this.state!==MediaDB.READY&&this.state!==MediaDB.ENUMERABLE){throw Error('MediaDB is not ready. State: '+this.state);}
var storage=navigator.getDeviceStorage(this.mediaType);var getRequest=storage.get(filename);getRequest.onsuccess=function(){callback(getRequest.result);};getRequest.onerror=function(){var errmsg=getRequest.error&&getRequest.error.name;if(errback){errback(errmsg);}else{console.error('MediaDB.getFile:',errmsg);}};},deleteFile:function deleteFile(filename,callback){if(this.state!==MediaDB.READY){throw Error('MediaDB is not ready. State: '+this.state);}
var storage=navigator.getDeviceStorage(this.mediaType);var req=storage.delete(filename);req.onerror=function(e){console.error('MediaDB.deleteFile(): Failed to delete',filename,'from DeviceStorage:',e.target.error);};req.onsuccess=function(){if(callback)
callback();};},addFile:function addFile(filename,file,callback,errcallback){if(this.state!==MediaDB.READY){throw Error('MediaDB is not ready. State: '+this.state);}
var media=this;var storage=navigator.getDeviceStorage(media.mediaType);var deletereq=storage.delete(filename);deletereq.onsuccess=deletereq.onerror=save;function save(){var request=storage.addNamed(file,filename);request.onsuccess=function(){console.log('MediaDB: operation successfully');if(callback){callback();}};request.onerror=function(){if(errcallback)
errcallback();console.error('MediaDB: Failed to store',filename,'in DeviceStorage:',request.error);};}},appendFile:function appendFile(filename,file,callback,errcallback){if(this.state!==MediaDB.READY){throw Error('MediaDB is not ready. State: '+this.state);}
const storage=navigator.getDeviceStorage(this.mediaType);append();function append(){const request=storage.appendNamed(file,filename);request.onsuccess=function(){console.log('MediaDB: operation successfully');if(callback){callback();}};request.onerror=function(){if(errcallback)
errcallback();console.error('MediaDB: Failed to store',filename,'in DeviceStorage:',request.error);};}},updateMetadata:function(filename,metadata,callback){if(this.state===MediaDB.OPENING){throw Error('MediaDB is not ready. State: '+this.state);}
var media=this;var read=media.db.transaction('files','readonly').objectStore('files').get(filename);read.onerror=function(){console.error('MediaDB.updateMetadata called with unknown filename');};read.onsuccess=function(){let fileinfo={};if(read.result){fileinfo=read.result;}else{fileinfo.metadata={};}
Object.keys(metadata).forEach(function(key){fileinfo.metadata[key]=metadata[key];});var write=media.db.transaction('files','readwrite').objectStore('files').put(fileinfo);write.onerror=function(){console.error('MediaDB.updateMetadata: database write failed',write.error&&write.error.name);};if(callback){write.onsuccess=function(){callback();};}};},count:function(key,range,callback){if(this.state!==MediaDB.READY&&this.state!==MediaDB.ENUMERABLE){throw Error('MediaDB is not ready or enumerable. State: '+this.state);}
if(arguments.length===1){callback=key;range=undefined;key=undefined;}
else if(arguments.length===2){callback=range;range=key;key=undefined;}
var store=this.db.transaction('files').objectStore('files');if(key&&key!=='name'){store=store.index(key);}
var countRequest=store.count(range||null);countRequest.onerror=function(){console.error('MediaDB.count() failed with',countRequest.error);};countRequest.onsuccess=function(e){callback(e.target.result);};},enumerate:function enumerate(key,range,direction,callback){if(this.state!==MediaDB.READY&&this.state!==MediaDB.ENUMERABLE){throw Error('MediaDB is not ready or enumerable. State: '+this.state);}
var handle={state:'enumerating'};if(arguments.length===1){callback=key;key=undefined;}
else if(arguments.length===2){callback=range;range=undefined;}
else if(arguments.length===3){callback=direction;direction=undefined;}
var store=this.db.transaction('files').objectStore('files');if(key&&key!=='name'){store=store.index(key);}
var cursorRequest=store.openCursor(range||null,direction||'next');cursorRequest.onerror=function(){console.error('MediaDB.enumerate() failed with',cursorRequest.error);handle.state='error';};cursorRequest.onsuccess=function(){if(handle.state==='cancelling'){handle.state='cancelled';return;}
var cursor=cursorRequest.result;if(cursor){try{var fileinfo=cursor.value;if(!fileinfo.fail){callback(fileinfo);}}
catch(e){console.warn('MediaDB.enumerate(): callback threw',e,e.stack);}
cursor.continue();}
else{handle.state='complete';callback(null);}};return handle;},advancedEnumerate:function(key,range,direction,index,callback){if(this.state!==MediaDB.READY){throw Error('MediaDB is not ready. State: '+this.state);}
var handle={state:'enumerating'};var store=this.db.transaction('files').objectStore('files');if(key&&key!=='name'){store=store.index(key);}
var cursorRequest=store.openCursor(range||null,direction||'next');var isTarget=false;cursorRequest.onerror=function(){console.error('MediaDB.enumerate() failed with',cursorRequest.error);handle.state='error';};cursorRequest.onsuccess=function(){if(handle.state==='cancelling'){handle.state='cancelled';return;}
var cursor=cursorRequest.result;if(cursor){try{if(index===0){isTarget=true;}
var fileinfo=cursor.value;if(!fileinfo.fail&&isTarget){callback(cursor.value);cursor.continue();}
else{cursor.advance(index);isTarget=true;}}
catch(e){console.warn('MediaDB.enumerate(): callback threw',e,e.stack);}}
else{handle.state='complete';callback(null);}};return handle;},enumerateAll:function enumerateAll(key,range,direction,callback){var batch=[];if(arguments.length===1){callback=key;key=undefined;}
else if(arguments.length===2){callback=range;range=undefined;}
else if(arguments.length===3){callback=direction;direction=undefined;}
return this.enumerate(key,range,direction,function(fileinfo){if(fileinfo!==null){batch.push(fileinfo);}else{callback(batch);}});},cancelEnumeration:function cancelEnumeration(handle){if(handle.state==='enumerating'){handle.state='cancelling';}},getAll:function getAll(callback){if(this.state!==MediaDB.READY&&this.state!==MediaDB.ENUMERABLE){throw Error('MediaDB is not ready or enumerable. State: '+this.state);}
var store=this.db.transaction('files').objectStore('files');var request=store.mozGetAll();request.onerror=function(){console.error('MediaDB.getAll() failed with',request.error);};request.onsuccess=function(){var all=request.result;var good=all.filter(function(fileinfo){return!fileinfo.fail;});callback(good);};},scan:function(){scan(this);},stopScan:function(){if(this.scanning){this.stopScanning=true;}},freeSpace:function freeSpace(callback){if(this.state!==MediaDB.READY){throw Error('MediaDB is not ready. State: '+this.state);}
var storage=navigator.getDeviceStorage(this.mediaType);var freereq=storage.freeSpace();freereq.onsuccess=function(){callback(freereq.result);};}};MediaDB.VERSION=3;MediaDB.OPENING='opening';MediaDB.UPGRADING='upgrading';MediaDB.ENUMERABLE='enumerable';MediaDB.READY='ready';MediaDB.NOCARD='nocard';MediaDB.UNMOUNTED='unmounted';MediaDB.CLOSED='closed';function ignore(media,file){if(ignoreName(media,file.name)){return true;}
if(media.mimeTypes&&media.mimeTypes.indexOf(file.type)===-1){return true;}
return false;}
function ignoreName(media,filename){if(media.clientExcludeFilter&&!media.clientExcludeFilter.test(filename)){return true;}else{var path=filename.substring(0,filename.lastIndexOf('/')+1);return(path[0]==='.'||path.indexOf('/.')!==-1);}}
function scan(media){if(media.details.storages.length<1){console.warn('MediaDB: No media storage, quit scanning');dispatchEvent(media,'nomediastorage');return;}
media.scanning=true;dispatchEvent(media,'scanstart');quickScan(media.details.newestFileModTime);function quickScan(timestamp){var options;media.details.containsData=false;if(timestamp>0){media.details.firstscan=false;options={since:new Date(timestamp+1)};}
else{media.details.firstscan=true;media.details.records=[];options={};}
scanDS(media.details.storages,null,options).then(processFiles).catch(handleScanError);function processFiles(files){if(!media.scanning){return;}
files=files.sort(function(a,b){return b.lastModifiedDate-a.lastModifiedDate;});media.filesLength=files.length;for(var i=0;i<files.length;i++){insertRecord(media,files[i]);}
whenDoneProcessing(media,function(){sendNotifications(media);if(media.details.firstscan){endscan(media);}
else{fullScan();}});}
function handleScanError(error){console.warn('Error while scanning',error);endscan(media);}}
function fullScan(){if(media.state!==MediaDB.READY){endscan(media);return;}
var dsfiles;scanDS(media.details.storages).then(function(files){dsfiles=files;getDBFiles();}).catch(function(error){console.warn('Error while scanning',error);endscan(media);});function getDBFiles(){var store=media.db.transaction('files').objectStore('files');var getAllRequest=store.mozGetAll();getAllRequest.onsuccess=function(){if(!media.scanning){return;}
var dbfiles=getAllRequest.result;compareLists(dbfiles,dsfiles);};}
function compareLists(dbfiles,dsfiles){dsfiles.sort(function(a,b){if(a.name<b.name){return-1;}else{return 1;}});var dsindex=0,dbindex=0;while(true){var dsfile;if(dsindex<dsfiles.length){dsfile=dsfiles[dsindex];}else{dsfile=null;}
var dbfile;if(dbindex<dbfiles.length){dbfile=dbfiles[dbindex];}else{dbfile=null;}
if(dsfile===null&&dbfile===null){break;}
if(dbfile===null){insertRecord(media,dsfile);dsindex++;continue;}
if(dsfile===null){deleteRecord(media,dbfile.name);dbindex++;continue;}
if(dsfile.name===dbfile.name){var lastModified=dsfile.lastModifiedDate;var timeDifference=lastModified.getTime()-dbfile.date;var sameTime=(timeDifference===0||((Math.abs(timeDifference)<=12*60*60*1000)&&(timeDifference%10*60*1000===0)));var sameSize=dsfile.size===dbfile.size;if(!sameTime||!sameSize){deleteRecord(media,dbfile.name);insertRecord(media,dsfile);}else if(dbfile.needsReparse){deleteRecord(media,dbfile.name);insertRecord(media,dsfile,dbfile.metadata);}
dsindex++;dbindex++;continue;}
if(dsfile.name<dbfile.name){insertRecord(media,dsfile);dsindex++;continue;}
if(dsfile.name>dbfile.name){deleteRecord(media,dbfile.name);dbindex++;continue;}
console.error('Assertion failed');}
insertRecord(media,null);}}
function scanDS(storage,directory,options){if(Array.isArray(storage)){return Promise.all(storage.map((s)=>scanDS(s,directory,options))).then(function(arrays){return Array.prototype.concat.apply([],arrays);});}
return new Promise(function(resolve,reject){var files=[];var cursor=storage.enumerate(directory||'',options||{});cursor.onerror=function(){if(cursor.error.name==='NotFoundError'){resolve(files);}
else{reject(cursor.error);}};cursor.onsuccess=function(){if(media.stopScanning){media.scanning=false;media.stopScanning=false;resolve(files);}
var result=cursor.result;if(result){if(!ignore(media,result)){files.push(result);}
cursor.continue();}
else{resolve(files);}};});}}
function endscan(media){if(media.scanning){media.scanning=false;media.parsingBigFiles=false;if(media.filesLength>media.errorLength){media.details.containsData=true;}
dispatchEvent(media,'scanend',{containsData:media.details.containsData,firstscan:media.details.firstscan});}}
function insertRecord(media,fileOrName,oldMetadata){var details=media.details;details.pendingInsertions.push([fileOrName,oldMetadata]);if(details.processingQueue){return;}
processQueue(media);}
function deleteRecord(media,filename){var details=media.details;details.pendingDeletions.push(filename);if(details.processingQueue){return;}
processQueue(media);}
function whenDoneProcessing(media,f){var details=media.details;if(details.processingQueue){details.whenDoneProcessing.push(f);}else{f();}}
function processQueue(media){var details=media.details;details.processingQueue=true;next();function next(){if(details.pendingDeletions.length>0){deleteFiles();}
else if(details.pendingInsertions.length>0){insertFile(...details.pendingInsertions.shift());}
else{details.processingQueue=false;if(details.whenDoneProcessing.length>0){var functions=details.whenDoneProcessing;details.whenDoneProcessing=[];functions.forEach(function(f){f();});}}}
function deleteFiles(){var transaction=media.db.transaction('files','readwrite');var store=transaction.objectStore('files');deleteNextFile();function deleteNextFile(){if(details.pendingDeletions.length===0){next();return;}
var filename=details.pendingDeletions.shift();var request=store.delete(filename);request.onerror=function(){console.warn('MediaDB: Unknown file in deleteRecord:',filename,request.error);deleteNextFile();};request.onsuccess=function(){queueDeleteNotification(media,filename);deleteNextFile();};}}
function insertFile(f,oldMetadata){if(f===null){sendNotifications(media);endscan(media);next();return;}
if(typeof f==='string'){var storage=navigator.getDeviceStorage(media.mediaType);var getreq=storage.get(f);getreq.onerror=function(){console.warn('MediaDB: Unknown file in insertRecord:',f,getreq.error);next();};getreq.onsuccess=function(){if(media.mimeTypes&&ignore(media,getreq.result)){next();}else{parseMetadata(getreq.result,f,oldMetadata);}};}
else{parseMetadata(f,f.name,oldMetadata);}}
function parseMetadata(file,filename,oldMetadata){if(!file.lastModifiedDate){console.warn('MediaDB: parseMetadata: no lastModifiedDate for',filename,'using Date.now() until #793955 is fixed');}
var fileinfo={name:filename,type:file.type,size:file.size,date:file.lastModifiedDate?file.lastModifiedDate.getTime():Date.now(),firstParseTime:file.firstParseTime?file.firstParseTime:Date.now()};if(fileinfo.date>details.newestFileModTime){details.newestFileModTime=fileinfo.date;}
media.metadataParser(file,gotMetadata,metadataError,parsingBigFile);function parsingBigFile(){media.parsingBigFiles=true;}
function metadataError(e){media.errorLength+=1;console.warn('MediaDB: error parsing metadata for',filename,':',e);fileinfo.fail=true;storeRecord(fileinfo);}
function gotMetadata(metadata){fileinfo.metadata=metadata;if(oldMetadata&&media.reparsedRecord){fileinfo.metadata=media.reparsedRecord(oldMetadata,metadata);}
storeRecord(fileinfo);if(!media.scanning){media.parsingBigFiles=false;}}}
function storeRecord(fileinfo){if(media.details.firstscan){media.details.records.push(fileinfo);if(!fileinfo.fail){queueCreateNotification(media,fileinfo);}
next();}
else{var transaction=media.db.transaction('files','readwrite');var store=transaction.objectStore('files');var request=store.add(fileinfo);request.onsuccess=function(){if(!fileinfo.fail){queueCreateNotification(media,fileinfo);}
next();};request.onerror=function(event){if(request.error.name==='ConstraintError'){event.stopPropagation();event.preventDefault();var putrequest=store.put(fileinfo);putrequest.onsuccess=function(){queueDeleteNotification(media,fileinfo.name);if(!fileinfo.fail){queueCreateNotification(media,fileinfo);}
next();};putrequest.onerror=function(){console.error('MediaDB: unexpected ConstraintError','in insertRecord for file:',fileinfo.name);next();};}else if(request.error.name==='QuotaExceededError'){var dbVersion=(0xFFFF&media.version)<<16|(0xFFFF&MediaDB.VERSION);var reopenRequest=indexedDB.open(media.dbname,dbVersion);reopenRequest.onsuccess=function(){media.db=reopenRequest.result;next();};reopenRequest.onerror=function(e){console.error('MediaDB reopenRequest error:',reopenRequest.error.name);next();};reopenRequest.onblocked=function(e){console.error('MediaDB is blocked. '+media.dbname);next();};}else{console.error('MediaDB: unexpected error in insertRecord:',request.error,'for file:',fileinfo.name);next();}};}}}
function queueCreateNotification(media,fileinfo){var creates=media.details.pendingCreateNotifications;creates.push(fileinfo);if(media.batchSize&&creates.length>=media.batchSize){sendNotifications(media);}else{resetNotificationTimer(media);}}
function queueDeleteNotification(media,filename){var deletes=media.details.pendingDeleteNotifications;deletes.push(filename);if(media.batchSize&&deletes.length>=media.batchSize){sendNotifications(media);}else{resetNotificationTimer(media);}}
function resetNotificationTimer(media){var details=media.details;if(details.pendingNotificationTimer){clearTimeout(details.pendingNotificationTimer);}
details.pendingNotificationTimer=setTimeout(function(){sendNotifications(media);},media.scanning?media.batchHoldTime:100);}
function sendNotifications(media){var details=media.details;if(details.pendingNotificationTimer){clearTimeout(details.pendingNotificationTimer);details.pendingNotificationTimer=null;}
if(details.pendingDeleteNotifications.length>0){var deletions=details.pendingDeleteNotifications;details.pendingDeleteNotifications=[];dispatchEvent(media,'deleted',deletions);}
if(details.pendingCreateNotifications.length===0){if(details.firstscan&&details.records.length===0){dispatchEvent(media,'empty',[]);}}
if(details.pendingCreateNotifications.length>0){var creations=details.pendingCreateNotifications;details.pendingCreateNotifications=[];if(details.firstscan&&details.records.length>0){var transaction=media.db.transaction('files','readwrite');var store=transaction.objectStore('files');for(var i=0;i<details.records.length;i++){store.add(details.records[i]);}
details.records.length=0;transaction.oncomplete=function(){dispatchEvent(media,'created',creations);};}
else{dispatchEvent(media,'created',creations);}}}
function dispatchEvent(media,type,detail){var handler=media['on'+type];var listeners=media.details.eventListeners[type];if(!handler&&(!listeners||listeners.length===0)){return;}
var event={type:type,target:media,currentTarget:media,timestamp:Date.now(),detail:detail};if(typeof handler==='function'){try{handler.call(media,event);}
catch(e){console.warn('MediaDB: ','on'+type,'event handler threw',e,e.stack);}}
if(!listeners){return;}
for(var i=0;i<listeners.length;i++){try{var listener=listeners[i];if(typeof listener==='function'){listener.call(media,event);}
else{listener.handleEvent(event);}}
catch(e){console.warn('MediaDB: ',type,'event listener threw',e,e.stack);}}}
function changeState(media,state){if(media.state!==state){media.state=state;switch(state){case MediaDB.READY:case MediaDB.ENUMERABLE:dispatchEvent(media,state);break;default:dispatchEvent(media,'unavailable',state);break;}}}
return MediaDB;}());