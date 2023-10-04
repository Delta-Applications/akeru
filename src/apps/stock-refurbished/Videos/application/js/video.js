'use strict';const LAYOUT_MODE={list:'layout-list',selection:'layout-selection',fullscreenPlayer:'layout-fullscreen-player'};const SUB_MODE={overlay:'overlay',infoView:'info-view',renameView:'rename-view',pickActivity:'pick-activity',dongleActivity:'dongle-activity'};var dom={};var ids=['thumbnails','thumbnails-select-top','thumbnails-number-selected','player-view','thumbnails-single-delete-button','thumbnails-single-share-button','thumbnails-single-info-button','info-view','player','overlay','overlay-title','overlay-text','video-container','videoBar','poster-img','close','play','playHead','timeSlider','elapsedTime','duration-text','elapsed-text','bufferedTime','slider-wrapper','picker-close','options-view','options-cancel-button','in-use-overlay','in-use-overlay-title','in-use-overlay-text','no-video','file-info','thumbnail-views','renameId'];ids.forEach(function createElementRef(name){dom[toCamelCase(name)]=document.getElementById(name);});dom.player.mozAudioChannelType='content';if(navigator.mozAudioChannelManager){navigator.mozAudioChannelManager.volumeControlChannel='content';}
function $(id){return document.getElementById(id);}
let releasePosterTimeout=null;var playing=false;var playerShowing=false;var endedTimer;var controlShowing=false;var controlFadeTimeout=null;var selectedFileNames=[];var selectedFileNamesToBlobs={};var videodb;var currentVideo;var currentVideoBlob;var firstScanEnded=false;var THUMBNAIL_WIDTH;var THUMBNAIL_HEIGHT;var HAVE_NOTHING=0;var storageState;var dragging=false;var isPausedWhileDragging;var sliderRect;var thumbnailList;var pendingPick;var videoHardwareReleased=false;var restoreTime=null;var currentLayoutMode;var isFullScreen=false;var isFullScreenAction=false;var canPlay=true;var lowMemory=false;var isSearching=true;var isEnumerateing=false;var isOpenCameraing=false;var autoFullScreen=false;var isDonglePickMultiple=false;var dongleEnabled=navigator.dongleManager&&navigator.dongleManager.dongleStatus;let audioChannelClient=null;let listViewScrollTop=null;let JIO_MEDIA_CABLE_APP_ORIGIN='app://jiomediacable.gaiamobile.org';var pendingUpdateTitleText=false;var FROMCAMERA=/DCIM\/\d{3}KAIOS\/VID_\d{4}\.3gp$/;var loadingChecker=new VideoLoadingChecker(dom.player,dom.inUseOverlay,dom.inUseOverlayTitle,dom.inUseOverlayText);var isDisplayToast=false;var totalDeletedCount=0;window.performance.mark('navigationLoaded');window.performance.mark('navigationInteractive');document.addEventListener('visibilitychange',function visibilityChange(){if(playerShowing){NavigationMap.updateFullScreenSet(false);}
if(document.hidden){stopParsingMetadata();if(playing){pause();}
VideoUtils.fromActivity=false;}
else{NavigationMap.disableNav=false;if(playerShowing){if(videoHardwareReleased){restoreVideo();}
setControlsVisibility(true);window.option.show();VideoUtils.fitContainer(dom.videoContainer,dom.player,currentVideo.metadata.rotation||0);}else{startParsingMetadata();}}});navigator.getFeature('hardware.memory').then((memOnDevice)=>{if(memOnDevice===256){lowMemory=true;}});navigator.dongleManager&&navigator.dongleManager.addEventListener('donglestatuschange',(evt)=>{dongleEnabled=evt.isConnected;hasJioMediaCable().then((hasApp)=>{if(hasApp&&currentLayoutMode===LAYOUT_MODE.fullscreenPlayer&&evt.isConnected){NavigationMap.updateFullScreenSet(false);pause();switchLayout(LAYOUT_MODE.list);dongleLinkResult([{path:currentVideo.name,title:currentVideo.metadata.title}]);}else if(hasApp&&!evt.isConnected&&currentLayoutMode===LAYOUT_MODE.selection){pendingPick.postResult();}});});navigator.mozL10n.once(function(){initDB();init();});thumbnailList=new ThumbnailList(ThumbnailDateGroup,dom.thumbnails);initLayout();initThumbnailSize();function init(){ThumbnailDateGroup.Template=new Template('thumbnail-group-header');ThumbnailItem.Template=new Template('thumbnail-template');ThumbnailItem.titleMaxLines=2;if(!navigator.mozHasPendingMessage('activity')){initOptionsButtons();}
initPlayerControls();var acm=navigator.mozAudioChannelManager;if(acm){acm.addEventListener('headphoneschange',function onheadphoneschange(){if(!acm.headphones&&playing){setVideoPlaying(false);}});}
navigator.mozSetMessageHandler('activity',handleActivityEvents);}
function initThumbnailSize(){THUMBNAIL_WIDTH=240*window.devicePixelRatio;THUMBNAIL_HEIGHT=240*window.devicePixelRatio;}
function initLayout(){ScreenLayout.watch('portrait','(orientation: portrait)');setDisabled(dom.playerView,false);window.addEventListener('screenlayoutchange',handleScreenLayoutChange);if(isDonglePickMultiple){switchLayout(LAYOUT_MODE.selection);}else{switchLayout(LAYOUT_MODE.list);}}
function initPlayerControls(){dom.player.addEventListener('timeupdate',timeUpdated);dom.player.addEventListener('seeked',updateVideoControlSlider);dom.player.addEventListener('ended',playerEnded);dom.videoContainer.addEventListener('click',toggleVideoControls);dom.timeSlider.addEventListener('keypress',handleSliderKeypress);}
function initOptionsButtons(){dom.optionsCancelButton.addEventListener('click',hideOptionsView);addEventListeners('.single-delete-button','click',deleteCurrentVideo);addEventListeners('.single-share-button','click',shareCurrentVideo);addEventListeners('.single-info-button','click',showInfoView);}
function addEventListeners(selector,type,listener){var elements=document.body.querySelectorAll(selector);for(var i=0;i<elements.length;i++){elements[i].addEventListener(type,listener);}}
function hasJioMediaCable(){return new Promise((resolve)=>{const pendingGetAll=navigator.mozApps.mgmt.getAll();pendingGetAll.onsuccess=(event)=>{const apps=event.target.result||[];const appIndex=apps.findIndex((mozApp)=>mozApp.origin.includes(JIO_MEDIA_CABLE_APP_ORIGIN));resolve(appIndex!==-1);};});}
function toggleFullscreenPlayer(e){if(currentLayoutMode===LAYOUT_MODE.list){switchLayout(LAYOUT_MODE.fullscreenPlayer);scheduleVideoControlsAutoHiding();}else{switchLayout(LAYOUT_MODE.list);}
VideoUtils.fitContainer(dom.videoContainer,dom.player,currentVideo.metadata.rotation||0);}
function toggleVideoControls(e){if(controlFadeTimeout){clearTimeout(controlFadeTimeout);controlFadeTimeout=null;}
if(!pendingPick){e.cancelBubble=!controlShowing;setControlsVisibility(!controlShowing);}}
function handleScreenLayoutChange(){if(currentLayoutMode!==LAYOUT_MODE.fullscreenPlayer){if(!thumbnailList){return;}
thumbnailList.updateAllThumbnailTitles();}else{pendingUpdateTitleText=true;}
if(dom.player.readyState!==HAVE_NOTHING){VideoUtils.fitContainer(dom.videoContainer,dom.player,currentVideo.metadata.rotation||0);}}
function switchLayout(mode,ignoreUpdate){var oldMode=currentLayoutMode;if(oldMode){document.body.classList.remove(currentLayoutMode);}
currentLayoutMode=mode;document.body.classList.add(currentLayoutMode);if(oldMode===LAYOUT_MODE.fullscreenPlayer&&pendingUpdateTitleText){pendingUpdateTitleText=false;if(!ignoreUpdate){thumbnailList.updateAllThumbnailTitles();}}
if(window.NavigationMap!=undefined){NavigationMap.onPanelChanged(oldMode,currentLayoutMode);}
if(oldMode===LAYOUT_MODE.list&&currentLayoutMode===LAYOUT_MODE.fullscreenPlayer&&!pendingPick){autoFullScreen=true;NavigationMap.reqFullscreen();}}
function handleActivityEvents(a){var fromActivity=a.source.name;VideoUtils.fromActivity=true;if(fromActivity==='pick'){if(a.source.data.type==='dongle/video'&&a.source.data.selectMode==='multiple'){isDonglePickMultiple=true;showDongleView();}else{showPickView();}
pendingPick=a;}}
function showDongleView(){document.body.classList.add('layout-selection');thumbnailList.setSelectMode(true);clearSelection();}
function showInfoView(){hideOptionsView();var length=isFinite(currentVideo.metadata.duration)?MediaUtils.formatDuration(currentVideo.metadata.duration):'';var size=isFinite(currentVideo.size)?MediaUtils.formatSize(currentVideo.size):'';var type=currentVideo.type;if(type){var index=currentVideo.type.indexOf('/');type=index>-1?currentVideo.type.slice(index+1):currentVideo.type;}
let date=new Date(currentVideo.date).toLocaleString(navigator.language,{year:'numeric',month:'2-digit',day:'2-digit'});var resolution=(currentVideo.metadata.width&&currentVideo.metadata.height)?currentVideo.metadata.width+'x'+
currentVideo.metadata.height:'';var data={'info-name':currentVideo.metadata.title,'info-length':length,'info-size':size.toLocaleString(navigator.language),'info-type':type,'info-date':date,'info-resolution':resolution};MediaUtils.populateMediaInfo(data);dom.infoView.classList.remove('hidden');dom.fileInfo.classList.remove('hidden');document.getElementById('infosection').scrollTop=0;document.body.classList.add(SUB_MODE.infoView);dom.fileInfo.classList.add('focus');dom.fileInfo.focus();if(window.performance.getEntriesByName('check-video-detail-start','mark').length>0){window.performance.mark('check-video-detail-end');window.performance.measure('performance-check-video-detail','check-video-detail-start','check-video-detail-end');window.performance.clearMeasures('performance-check-video-detail');window.performance.clearMarks('check-video-detail-start');window.performance.clearMarks('check-video-detail-end');}
NavigationMap.onPanelChanged(currentLayoutMode,SUB_MODE.infoView);}
function hideInfoView(notChangePannel){dom.infoView.classList.add('hidden');dom.fileInfo.classList.add('hidden');document.body.classList.remove(SUB_MODE.infoView);NavigationMap.onPanelChanged(SUB_MODE.infoView,currentLayoutMode);}
function showSelectView(){thumbnailList.setSelectMode(true);clearSelection();switchLayout(LAYOUT_MODE.selection);}
function hideSelectView(){let li=document.querySelectorAll('.thumbnail');for(let m=0;m<li.length;m++){li[m].children[0].classList.remove('layout-selection');}
thumbnailList.setSelectMode(false);switchLayout(LAYOUT_MODE.list);}
function showOptionsView(){if(playing){pause();}
dom.optionsView.classList.remove('hidden');document.body.classList.add('options-view');}
function hideOptionsView(){dom.optionsView.classList.add('hidden');document.body.classList.remove('options-view');}
function setDisabled(element,disabled){element.classList.toggle('disabled',disabled);element.setAttribute('aria-disabled',disabled);}
function setSelected(element,selected){element.classList.toggle('selected',selected);element.children[0].classList.toggle('selected',selected);}
function clearSelection(){let li=document.querySelectorAll('.thumbnail');for(let m=0;m<li.length;m++){li[m].children[0].classList.add('layout-selection');}
const selectedLength=selectedFileNames.length;for(let i=0;i<selectedLength;i++){setSelected(thumbnailList.thumbnailMap[selectedFileNames[i]].htmlNode,false);}
selectedFileNames=[];selectedFileNamesToBlobs={};dom.thumbnailsNumberSelected.textContent=navigator.mozL10n.get('number-selected2',{n:0});}
function updateSelectedNumber(number){dom.thumbnailsNumberSelected.textContent=navigator.mozL10n.get('number-selected2',{n:number});}
function updateSelection(videodata){var thumbnail=thumbnailList.thumbnailMap[videodata.name];var selected=!thumbnail.htmlNode.classList.contains('selected');if(isDonglePickMultiple){let limit=pendingPick.source.data.limit||50;if(selectedFileNames.length>=limit&&selected){return;}}
setSelected(thumbnail.htmlNode,selected);var filename=videodata.name;if(selected){selectedFileNames.push(filename);videodb.getFile(filename,function(blob){selectedFileNamesToBlobs[filename]=blob;});}
else{delete selectedFileNamesToBlobs[filename];var i=selectedFileNames.indexOf(filename);if(i!==-1)
selectedFileNames.splice(i,1);}
updateSelectedNumber(selectedFileNames.length);}
function launchCameraApp(){if(isOpenCameraing){return;}
isOpenCameraing=true;var cameraActivity=new MozActivity({name:'record',data:{type:'videos'}});cameraActivity.onsuccess=()=>{isOpenCameraing=false;}
cameraActivity.onerror=(err)=>{isOpenCameraing=false;console.error('Open camera is fail',err);}}
function resetCurrentVideo(){if(!currentVideo){return;}
var currentThumbnail=thumbnailList.thumbnailMap[currentVideo.name];currentThumbnail.htmlNode.classList.remove('focused');var nextThumbnail=thumbnailList.findNextThumbnail(currentVideo.name);if(nextThumbnail){currentVideo=nextThumbnail.data;nextThumbnail.htmlNode.classList.add('focused');}else{currentVideo=null;}}
function deleteSelectedItems(deleteDone){if(selectedFileNames.length===0)
return;totalDeletedCount=selectedFileNames.length;window.option.hide();var dialogConfig={title:{id:'confirmation-title',args:{}},body:{id:'delete-n-items?',args:{n:selectedFileNames.length}},cancel:{l10nId:'cancel',priority:1,callback:function(){window.option.show();VideoUtils.isShowDialog=false;}},confirm:{l10nId:'delete',priority:3,callback:function(){window.performance.mark('delete-all-video-start');const selectedFilesLength=selectedFileNames.length;let storageSuccess=[];let storageError=[];const storage=navigator.getDeviceStorage('videos');for(let i=0;i<selectedFilesLength;i++){const item=selectedFileNames[i];const deleteRequest=storage.delete(item);deleteRequest.onsuccess=()=>{storageSuccess.push(item);const successCount=storageSuccess.length;const errorCount=storageError.length;if(successCount+errorCount!==selectedFilesLength){return;}
for(let j=0;j<successCount;j++){thumbnailList.removeItem(storageSuccess[j]);}
if(deleteDone){deleteDone(storageSuccess);storageSuccess=[];storageError=[];}};deleteRequest.onerror=(e)=>{storageError.push(item);console.error('Failed to delete',item,'from DeviceStorage:',e.target.error);};}}}};confirmDialog(dialogConfig);}
function deleteFilesDone(){hideSelectView();let li=document.querySelectorAll('.thumbnail');for(let m=0;m<li.length;m++){li[m].children[0].classList.add('layout-selection');}
selectedFileNames=[];selectedFileNamesToBlobs={};dom.thumbnailsNumberSelected.textContent=navigator.mozL10n.get('number-selected2',{n:0});if(thumbnailList.count===0){NavigationMap.setSoftKeyBar(LAYOUT_MODE.list);showOverlay('empty');}}
function deleteFile(filename){if(FROMCAMERA.test(filename)){var postername=filename.replace('.3gp','.jpg');navigator.getDeviceStorage('pictures').delete(postername);}
videodb.deleteFile(filename);}
function shareSelectedItems(){var blobs=selectedFileNames.map(function(name){return selectedFileNamesToBlobs[name];});share(blobs);}
function share(blobs){if(blobs.length===0)
return;var names=[],fullpaths=[];blobs.forEach(function(blob){var name=blob.name;fullpaths.push(name);name=name.substring(name.lastIndexOf('/')+1);names.push(name);});if(playerShowing){releaseVideo();}
var shareActivity=new MozActivity({name:'share',data:{type:'video/*',number:blobs.length,blobs:blobs,filenames:names,filepaths:fullpaths}});shareActivity.onsuccess=function(e){NavigationMap.disableNav=false;restoreVideo();};shareActivity.onerror=function(e){if(shareActivity.error.name==='NO_PROVIDER'){var msg=navigator.mozL10n.get('share-noprovider');alert(msg);}else{console.warn('share activity error:',shareActivity.error.name);}
NavigationMap.disableNav=false;restoreVideo();};}
function updateDialog(){if(thumbnailList.count!==0&&(!storageState||playerShowing)){showOverlay(null);}else if(firstScanEnded&&thumbnailList.count===0&&metadataQueue.length===0){NavigationMap.setSoftKeyBar(LAYOUT_MODE.list);if(isSearching){showOverlay('search');}else{showOverlay('empty');}}}
function thumbnailClickHandler(videodata){hasJioMediaCable().then((hasApp)=>{if(hasApp&&dongleEnabled&&!isDonglePickMultiple){dongleLinkResult([{path:videodata.name,title:videodata.metadata.title}]);return;}});if(lowMemory&&pendingPick){videodb.getFile(videodata.name,function(file){pendingPick.postResult({type:file.type,blob:file});});return;}
window.performance.mark('video-play-start');if(currentLayoutMode===LAYOUT_MODE.list){hidePlayer(true,function(){stopParsingMetadata(function(){setPosterImage(dom.posterImg,currentVideo.metadata.poster);showPlayer(videodata,true,true,pendingPick);});});}
else if(currentLayoutMode===LAYOUT_MODE.selection){updateSelection(videodata);NavigationMap.setSoftKeyBar(currentLayoutMode);}}
function setPosterImage(dom,poster){if(dom.dataset.uri){URL.revokeObjectURL(dom.dataset.uri);}
dom.dataset.uri=URL.createObjectURL(poster);dom.style.backgroundImage='url('+dom.dataset.uri+')';dom.style.backgroundSize='100% 100%';}
function releasePosterImage(dom){if(dom.dataset.uri){URL.revokeObjectURL(dom.dataset.uri);}
dom.dataset.uri=null;dom.style.backgroundImage=null;}
function showOverlay(id){LazyLoader.load('shared/style/confirm.css',function(){if(id===null){document.body.classList.remove(SUB_MODE.overlay);dom.overlay.classList.add('hidden');dom.noVideo.classList.add('hidden');if(isDonglePickMultiple){switchLayout(LAYOUT_MODE.selection);}else if(!playerShowing){switchLayout(LAYOUT_MODE.list);}
return;}
var text;let title;if(id==='nocard'){text='nocard3-text';}else{if(VideoUtils.fromActivity){text=id+'-text';title='pick-title'}else{text=id+'-content';}}
title&&dom.overlayTitle.setAttribute('data-l10n-id',title);dom.overlayText.setAttribute('data-l10n-id',text);dom.overlay.classList.remove('hidden');document.body.classList.add(SUB_MODE.overlay);dom.noVideo.classList.remove('hidden');});}
function setControlsColor(color){document.getElementsByTagName('meta')['theme-color'].setAttribute('content',color);}
function setControlsVisibility(visible){dom.playerView.classList[visible?'remove':'add']('video-controls-hidden');controlShowing=visible;if(visible){document.body.classList.remove('video-controls-hidden');setControlsColor('rgb(0, 0, 0)');}else{document.body.classList.add('video-controls-hidden');setControlsColor('rgb(0,0,0)');}
dom.videoContainer.setAttribute('data-l10n-id',controlShowing?'hide-controls-button':'show-controls-button');if(controlShowing){updateVideoControlSlider();}}
function movePlayHead(percent){dom.playHead.style.left=percent;}
function updateVideoControlSlider(){if(dom.player.seeking){return;}
var percent=(dom.player.currentTime/dom.player.duration)*100;if(isNaN(percent)){return;}
percent+='%';dom.elapsedText.textContent=MediaUtils.formatDuration(dom.player.currentTime);dom.elapsedTime.style.width=percent;var remainingTime=dom.player.duration-dom.player.currentTime;dom.durationText.textContent=(remainingTime>0)?'-'+MediaUtils.formatDuration(remainingTime):'---:--';if(!dragging){movePlayHead(percent);}}
function setVideoPlaying(playing){if(playing){play();}else{pause();}}
function deleteCurrentVideo(){hideOptionsView();window.option.hide();totalDeletedCount=1;var dialogConfig={title:{id:'confirmation-title',args:{}},body:{id:'delete-video?',args:{}},cancel:{l10nId:'cancel',priority:1,callback:function(){if(currentLayoutMode===LAYOUT_MODE.fullscreenPlayer){setButtonPaused(true);}
VideoUtils.isShowDialog=false;window.option.show();}},confirm:{l10nId:'delete',priority:3,callback:function(){window.performance.mark('delete-a-video-start');deleteFile(currentVideo.name);if(currentLayoutMode===LAYOUT_MODE.list){hidePlayer(false);}else if(currentLayoutMode===LAYOUT_MODE.fullscreenPlayer){next(true);}
NavigationMap.setSoftKeyBar(currentLayoutMode);}}};confirmDialog(dialogConfig);}
function handlePlayButtonClick(){setVideoPlaying(dom.player.paused);}
function handleCloseButtonClick(){hidePlayer(true);}
function dongleLinkResult(val){const activity=new window.MozActivity({name:'show',data:{type:'dongle/controller',mediaType:'video',mediaList:val}});activity.onerror=()=>{console.error('jio dongle activity error!')}}
function postPickResult(){pendingPick.postResult({type:currentVideoBlob.type,blob:currentVideoBlob});}
function shareCurrentVideo(){hideOptionsView();videodb.getFile(currentVideo.name,function(blob){share([blob]);});}
function setVideoUrl(player,video,callback){if(!player.oncanplay){player.oncanplay=()=>{releasePosterTimeout=setTimeout(()=>{releasePosterImage(dom.posterImg);},500);if(window.performance.getEntriesByName('video-play-start','mark').length>0){window.performance.mark('video-play-end');window.performance.measure('performance-video-play','video-play-start','video-play-end');window.performance.clearMeasures('performance-video-play');window.performance.clearMarks('video-play-start');window.performance.clearMarks('video-play-end');}}}
function handleLoadedMetadata(){dom.player.onloadedmetadata=null;callback();}
function loadVideo(url){loadingChecker.ensureVideoLoads(handleLoadedMetadata);player.src=url;}
if('name'in video){videodb.getFile(video.name,function(file){var url=URL.createObjectURL(file);loadVideo(url);if(pendingPick)
currentVideoBlob=file;});}else if('url'in video){loadVideo(video.url);}}
function scheduleVideoControlsAutoHiding(){controlFadeTimeout=setTimeout(function(){setControlsVisibility(false);},250);}
function showPlayer(video,autoPlay,enterFullscreen,keepControls){if(currentVideo){var old=thumbnailList.thumbnailMap[currentVideo.name];old.htmlNode.classList.remove('focused');}
currentVideo=video;var thumbnail=thumbnailList.thumbnailMap[currentVideo.name];thumbnail.htmlNode.classList.add('focused');dom.player.preload='metadata';function doneSeeking(){dom.player.onseeked=null;setControlsVisibility(!autoFullScreen);if(autoFullScreen){autoFullScreen=false;}
if(autoPlay){play();}else{pause();setPosterImage(dom.player,currentVideo.metadata.bookmark||currentVideo.metadata.poster);}
dom.player.hidden=false;}
dom.player.hidden=true;setVideoUrl(dom.player,currentVideo,function(){if(enterFullscreen){switchLayout(LAYOUT_MODE.fullscreenPlayer);}
var formattedDuration=MediaUtils.formatDuration(dom.player.duration);dom.durationText.textContent=formattedDuration;timeUpdated();setButtonPaused(false);playerShowing=true;var rotation;if('metadata'in currentVideo){if(currentVideo.metadata.currentTime===dom.player.duration){currentVideo.metadata.currentTime=0;}
dom.player.currentTime=0;rotation=currentVideo.metadata.rotation;}else{dom.player.currentTime=0;rotation=0;}
navigator.mozL10n.setAttributes(dom.timeSlider,'seek-bar',{duration:formattedDuration});dom.timeSlider.setAttribute('aria-valuemin',0);dom.timeSlider.setAttribute('aria-valuemax',dom.player.duration);dom.timeSlider.setAttribute('aria-valuenow',dom.player.currentTime);dom.timeSlider.setAttribute('aria-valuetext',MediaUtils.formatDuration(dom.player.currentTime));VideoUtils.fitContainer(dom.videoContainer,dom.player,rotation||0);if(dom.player.seeking){dom.player.onseeked=doneSeeking;}else{doneSeeking();}});}
function hidePlayer(updateVideoMetadata,callback){if(!playerShowing){if(callback){callback();}
return;}
audioChannelClient.abandonChannel();dom.player.style.backgroundImage='none';dom.player.pause();playing=false;function completeHidingPlayer(){switchLayout(LAYOUT_MODE.list,true);setButtonPaused(false);playerShowing=false;updateDialog();dom.player.removeAttribute('src');dom.player.load();startParsingMetadata();if(callback){callback();}}
if(!currentVideo||!('metadata'in currentVideo)||!updateVideoMetadata||pendingPick){completeHidingPlayer();return;}
var video=currentVideo;var thumbnail=thumbnailList.thumbnailMap[video.name];if(dom.player.currentTime===0){video.metadata.bookmark=null;}
function updateMetadata(){if(!video.metadata.watched){video.metadata.watched=true;thumbnail.setWatched(true);}
completeHidingPlayer();}
clearTimeout(releasePosterTimeout);updateMetadata();}
function playerEnded(){if(dragging){return;}
if(endedTimer){clearTimeout(endedTimer);endedTimer=null;}
if(playing){dom.player.currentTime=0;pause();}
if(isFullScreen){NavigationMap.updateFullScreenSet();}
if(audioChannelClient){audioChannelClient.abandonChannel();}}
function setButtonPaused(paused){NavigationMap.updateSoftKey(paused);}
function play(){loadingChecker.ensureVideoPlays();setButtonPaused(false);VideoStats.start(dom.player);dom.player.play();playing=true;audioChannelClient=new AudioChannelClient('normal');audioChannelClient.requestChannel();}
function pause(noUpdateSK){loadingChecker.cancelEnsureVideoPlays();if(noUpdateSK===undefined){setButtonPaused(true);}
if(dragging){dragging=false;dom.playHead.classList.remove('active');}
dom.player.pause();playing=false;VideoStats.stop();VideoStats.dump();}
function getcurrentIndex(){var keys=Object.keys(thumbnailList.thumbnailMap);var i;for(i=0;i<keys.length;i++){if(keys[i]===currentVideo.name){return i;}}
return 0;}
function updateListFocus(val,option){let control=NavigationMap.getCurControl();if(val==='previous'){if(control.index===0){control.index=control.elements.length-1;}else{control.index--;}}else{if(control.index===control.elements.length-1){control.index=0;}else{!option&&control.index++;}}}
function next(option=false){updateListFocus('next',option);var videodata=thumbnailList.nextThumbnail(currentVideo.name).data;dom.player.style.backgroundImage='none';showPlayer(videodata,playing,true,pendingPick);}
function previous(){updateListFocus('previous');var videodata=thumbnailList.prevThumbnail(currentVideo.name).data;dom.player.style.backgroundImage='none';showPlayer(videodata,playing,true,pendingPick);}
function timeUpdated(){if(controlShowing){if(dom.player.duration===Infinity||dom.player.duration===0){return;}
updateVideoControlSlider();}
dom.timeSlider.setAttribute('aria-valuenow',dom.player.currentTime);dom.timeSlider.setAttribute('aria-valuetext',MediaUtils.formatDuration(dom.player.currentTime));if(!endedTimer){if(!dragging&&dom.player.currentTime>=dom.player.duration-1){var timeUntilEnd=(dom.player.duration-dom.player.currentTime+.5);endedTimer=setTimeout(playerEnded,timeUntilEnd*1000);}}else if(dragging&&dom.player.currentTime<dom.player.duration-1){clearTimeout(endedTimer);endedTimer=null;}}
function handleSliderKeypress(event){var step=Math.max(dom.player.duration/20,2);if(event.keyCode===event.DOM_VK_DOWN){dom.player.fastSeek(dom.player.currentTime-step);}else if(event.keyCode===event.DOM_VK_UP){dom.player.fastSeek(dom.player.currentTime+step);}}
function toCamelCase(str){return str.replace(/\-(.)/g,function replacer(str,p1){return p1.toUpperCase();});}
function showPickView(){thumbnailList.setPickMode(true);document.body.classList.add(SUB_MODE.pickActivity);}
function cancelPick(){pendingPick.postError('pick cancelled');cleanupPick();VideoUtils.fromActivity=false;}
function cleanupPick(){pendingPick=null;currentVideoBlob=null;hidePlayer(false);}
function releaseVideo(){if(videoHardwareReleased){return;}
videoHardwareReleased=true;if(dom.player.readyState>0){restoreTime=dom.player.currentTime;}
else{restoreTime=0;}
captureFrame(dom.player,currentVideo.metadata,function(sharemark){setPosterImage(dom.player,sharemark)});var videoWidth=dom.player.videoWidth;var videoHeight=dom.player.videoHeight;dom.player.removeAttribute('src');dom.player.load();dom.player.style.width=videoWidth+'px';dom.player.style.height=videoHeight+'px';}
function restoreVideo(){if(!videoHardwareReleased){return;}
videoHardwareReleased=false;setVideoUrl(dom.player,currentVideo,function(){VideoUtils.fitContainer(dom.videoContainer,dom.player,currentVideo.metadata.rotation||0);dom.player.currentTime=restoreTime;});if(currentLayoutMode===LAYOUT_MODE.fullscreenPlayer){NavigationMap.updateSoftKey(true);}}
window.addEventListener('storage',function(e){if(e.key==='view-activity-wants-to-use-hardware'&&e.newValue&&!document.hidden&&playerShowing&&!videoHardwareReleased){console.log('The video app view activity needs to play a video.');console.log('Pausing the video and returning to the thumbnails.');console.log('See bug 1088456.');handleCloseButtonClick();}});window.addEventListener('index-changed',(e)=>{var item=e.detail.focusedItem;for(var filename in thumbnailList.thumbnailMap){if(thumbnailList.thumbnailMap[filename].htmlNode==item){currentVideo=thumbnailList.thumbnailMap[filename].data;break;}}});function seekVideo(seekTime){if(seekTime>=dom.player.duration){seekTime=0;pause();}
else if(seekTime<0){seekTime=0;}
dom.player.fastSeek(seekTime);};function confirmDialog(dialogConfig){if(typeof ConfirmDialogHelper==='undefined'){LazyLoader.load('js/shared/confirm_dialog_helper.js',()=>{var dialog=new ConfirmDialogHelper(dialogConfig);dialog.show(document.getElementById('confirm-dialog-container'));});}else{var dialog=new ConfirmDialogHelper(dialogConfig);dialog.show(document.getElementById('confirm-dialog-container'));}
VideoUtils.isShowDialog=true;}