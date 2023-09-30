
function initDB(){videodb=new MediaDB('videos',null);document.addEventListener('visibilitychange',()=>{if(!playerShowing){if(!document.hidden){videodb.scan(this);if(firstScanEnded&&thumbnailList.count===0&&metadataQueue.length===0){showOverlay('empty');}}else{videodb.stopScan();}}});videodb.onopenMediaDBFail=function(evt){window.close();}
videodb.onupgrading=function(evt){storageState=MediaDB.UPGRADING;updateDialog();};videodb.onunavailable=function(event){storageState=event.detail;if(playerShowing){hidePlayer(true);}
updateDialog();};videodb.oncardremoved=function(){if(playerShowing)
hidePlayer(true);};videodb.onenumerable=function(){storageState=false;enumerateDB();};videodb.onempty=function(){isSearching=false;updateDialog();};videodb.onscanend=function(){if(!videodb.details.firstscan){isSearching=false;}
if(!firstScanEnded){firstScanEnded=true;window.performance.mark('fullyLoaded');if(currentLayoutMode==='layout-list'&&!option.menuVisible){updateDialog();}}};videodb.oncreated=function(event){if(event.detail.length===1&&!document.hasFocus()){if(event.detail[0].name.search(/^.+(\/\.tmp\.3gp)$/)!==-1){return;}}
event.detail.forEach(videoCreated);};videodb.ondeleted=function(event){if(event.detail.length===1&&!document.hasFocus()){if(event.detail[0].search(/^.+(\/\.tmp\.3gp)$/)!==-1){return;}}
if(event.detail.length===1){if(window.performance.getEntriesByName('delete-a-video-start','mark').length>0){window.performance.mark('delete-a-video-end');window.performance.measure('performance-delete-a-video','delete-a-video-start','delete-a-video-end');window.performance.clearMeasures('performance-delete-a-video');window.performance.clearMarks('delete-a-video-start');window.performance.clearMarks('delete-a-video-end');}}else{if(window.performance.getEntriesByName('delete-all-video-start','mark').length>0){window.performance.mark('delete-all-video-end');window.performance.measure('performance-delete-all-video','delete-all-video-start','delete-all-video-end');window.performance.clearMeasures('performance-delete-all-video');window.performance.clearMarks('delete-all-video-start');window.performance.clearMarks('delete-all-video-end');}}
if(isDisplayToast){isDisplayToast=false;Toaster.showToast({messageL10nId:'n-video-deleted',messageL10nArgs:{n:totalDeletedCount}});}
if(window.option.menuVisible){window.option.menuVisible=false;window.option.hideMenu();}
let bodyClass=document.body.className.split(' ');if(bodyClass.indexOf('info-view')!==-1){hideInfoView();}else if(currentLayoutMode!=='layout-selection'){if(!playerShowing){updateDialog();}}
const videoListLength=event.detail.length;for(let i=0;i<videoListLength;i++){let index=selectedFileNames.indexOf(event.detail[i]);if(index!==-1){selectedFileNames.splice(index,1);}
videoDeleted(event.detail[i]);}};}
var lastIndexDb=0;var lastIndex=null;var enumerateDone=false;function enumerateDB(){var firstBatchDisplayed=false;var batch=[];const limitByLoad=lastIndexDb+10;const enumerateEntry=videoinfo=>{if(videoinfo===null){flush();batch=[];enumerateDone=enumerate.state==='complete';return;}
var isVideo=videoinfo.metadata.isVideo;if(isVideo===false){return;}
if(isVideo===undefined){addToMetadataQueue(videoinfo);lastIndexDb++;return;}
if(isVideo===true){lastIndexDb++;batch.push(videoinfo);}
if(lastIndexDb%10===0){isEnumerateing=false;flush();batch=[];return;}};var enumerate=lastIndexDb===0?videodb.enumerate('date',null,'prev',enumerateEntry):videodb.advancedEnumerate('date',null,'prev',lastIndexDb,enumerateEntry);function flush(){batch.forEach(addVideo);batch.length=0;if(!firstBatchDisplayed){firstBatchDisplayed=true;window.dispatchEvent(new CustomEvent('visual-loaded',{detail:{index:this.lastIndex}}));window.performance.mark('visuallyLoaded');window.performance.mark('contentInteractive');}}}
function addVideo(videodata){if(!videodata||!videodata.metadata.isVideo){return;}
var view=thumbnailList.addItem(videodata);if(thumbnailList.count===1&&firstScanEnded){updateDialog();}}
function videoCreated(videoinfo){addToMetadataQueue(videoinfo);}
function videoDeleted(filename){if(currentVideo&&filename===currentVideo.name){resetCurrentVideo();}
thumbnailList.removeItem(filename);if(thumbnailList.count===0){hidePlayer(true);updateDialog();hideSelectView();}}