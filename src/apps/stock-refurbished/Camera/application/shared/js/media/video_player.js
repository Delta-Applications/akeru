'use strict';function VideoPlayer(container,autoHideProgressBar){if(typeof container==='string')
container=document.getElementById(container);container.classList.add('video-player-container');VideoPlayer.instancesToLocalize.set(container,this);function newelt(parent,type,classes,l10n_id,attributes){var e=document.createElement(type);if(classes){e.className=classes;}
if(l10n_id){e.dataset.l10nId=l10n_id;}
if(attributes){for(var attribute in attributes){e.setAttribute(attribute,attributes[attribute]);}}
parent.appendChild(e);return e;}
var poster=newelt(container,'img','videoPoster');var player=newelt(container,'video','videoPlayer');var controls=newelt(container,'div','videoPlayerControls');var playbutton=newelt(controls,'button','videoPlayerPlayButton','playbackPlay');var footer=newelt(controls,'div','videoPlayerFooter hidden');var pausebutton=newelt(footer,'button','videoPlayerPauseButton','playbackPause');var slider=newelt(footer,'div','videoPlayerSlider',null,{'role':'slider','aria-valuemin':0});var elapsedText=newelt(slider,'span','videoPlayerElapsedText p-thi');var progress=newelt(slider,'div','videoPlayerProgress');var backgroundBar=newelt(progress,'div','videoPlayerBackgroundBar');var elapsedBar=newelt(progress,'div','videoPlayerElapsedBar');var durationText=newelt(slider,'span','videoPlayerDurationText p-thi');var fullscreenButton=newelt(slider,'button','videoPlayerFullscreenButton','playbackFullscreen');this.autoHideFooter=!!autoHideProgressBar;this.footer=footer;this.poster=poster;this.player=player;this.controls=controls;this.playing=false;player.preload='metadata';player.mozAudioChannelType='content';var self=this;var controlsHidden=false;var dragging=false;var pausedBeforeDragging=false;var endedTimer;var videourl;var posterurl;var rotation;var videotimestamp;var orientation=0;var videowidth,videoheight;var playbackTime;var capturedFrame;this.load=function(video,posterimage,width,height,rotate,timestamp){this.reset();videourl=video;posterurl=posterimage;rotation=rotate||0;videowidth=width;videoheight=height;videotimestamp=timestamp;if(navigator.mozL10n.readyState==='complete'){this.localize();}
this.init();setPlayerSize();};this.reset=function(){videotimestamp=0;if(!footer.classList.contains('hidden')){this.showFooter(true);}
this.resetPlayer();hidePlayer();hidePoster();};this.init=function(){playbackTime=0;hidePlayer();showPoster();this.pause();};this.showFooter=function(bShown){if(arguments[0]===undefined)
bShown=true;if(bShown){footer.classList.remove('hidden');}else{footer.classList.add('hidden');}};function hidePlayer(){player.style.display='none';player.removeAttribute('src');player.load();self.playerShowing=false;}
function showPlayer(){if(self.onloading){self.onloading();}
player.style.display='block';player.src=videourl;self.playerShowing=true;player.oncanplay=function(){player.oncanplay=null;if(playbackTime!==0){player.currentTime=playbackTime;}
self.play();};player.onplay=()=>{setTimeout(()=>{hidePoster();},300);};}
function hidePoster(){poster.style.display='none';poster.removeAttribute('src');if(capturedFrame){URL.revokeObjectURL(capturedFrame);capturedFrame=null;}}
function showPoster(){poster.style.display='block';if(capturedFrame)
poster.src=capturedFrame;else
poster.src=posterurl;}
this.setPlayerSize=setPlayerSize;this.setPlayerOrientation=setPlayerOrientation;this.pause=function pause(){if(!this.playing){return;}
if(self.playerShowing){this.playing=false;player.pause();}
playbutton.classList.remove('hidden');if(this.onpaused)
this.onpaused();};this.resetPlayer=function _resetPlayer(){footer.classList.add('hidden');player.currentTime=0;this.pause();updateTime();};this.play=function play(){if(!this.playerShowing){showPlayer();return;}
playbutton.classList.add('hidden');this.playing=true;player.play();footer.classList.remove('hidden');controlsHidden=false;if(this.onFooterShow){this.onFooterShow();}
if(this.onplaying){this.onplaying();}};fullscreenButton.addEventListener('tap',function(e){if(self.onfullscreentap){e.stopPropagation();self.onfullscreentap();}});playbutton.addEventListener('tap',function(e){if(!self.playerShowing||player.paused){self.play();}
e.stopPropagation();});pausebutton.addEventListener('tap',function(e){self.pause();e.stopPropagation();});controls.addEventListener('tap',function(e){if(e.target===controls&&!player.paused){footer.classList.toggle('hidden');controlsHidden=!controlsHidden;}});player.onloadedmetadata=function(){var formattedTime=formatTime(player.duration);durationText.textContent='-'+formattedTime;slider.setAttribute('aria-valuemax',player.duration);navigator.mozL10n.setAttributes(slider,'playbackSeekBar',{'duration':formattedTime});self.pause();};player.onended=ended;function ended(){if(dragging)
return;if(endedTimer){clearTimeout(endedTimer);endedTimer=null;}
self.pause();footer.classList.add('hidden');self.init();if(self.onFooterHide){self.onFooterHide();}
if(self.autoHideFooter){self.showFooter(false);}};player.ontimeupdate=updateTime;function updateTime(){if(isNaN(player.duration)){return;}
if(!controlsHidden){var formattedElapsedTime=formatTime(player.currentTime);var formattedDurationTime=formatTime(player.duration-player.currentTime);durationText.textContent='-'+formattedDurationTime;elapsedText.textContent=formattedElapsedTime;slider.setAttribute('aria-valuenow',player.currentTime);slider.setAttribute('aria-valuetext',formattedElapsedTime);if(player.duration===Infinity||player.duration===0)
return;var percent=(player.currentTime/player.duration)*100+'%';var startEdge=navigator.mozL10n.language.direction==='ltr'?'left':'right';elapsedBar.style.width=percent;}
if(player.currentTime===player.duration){elapsedBar.style.width=0;}
if(!endedTimer){if(!dragging&&player.currentTime>=player.duration-1){var timeUntilEnd=(player.duration-player.currentTime+.5);endedTimer=setTimeout(ended,timeUntilEnd*1000);}}
else if(dragging&&player.currentTime<player.duration-1){clearTimeout(endedTimer);endedTimer=null;}}
this.onVisibilityChange=visibilityChanged;function visibilityChanged(){if(document.hidden){if(!self.playerShowing)
return;self.pause();if(player.currentTime!==0){playbackTime=player.currentTime;captureCurrentFrame(function(blob){capturedFrame=URL.createObjectURL(blob);hidePlayer();showPoster();});}
else{hidePlayer();showPoster();}}}
function captureCurrentFrame(callback){var canvas=document.createElement('canvas');canvas.width=videowidth;canvas.height=videoheight;var context=canvas.getContext('2d');context.drawImage(player,0,0);canvas.toBlob(callback);}
this.setPlayerSize=setPlayerSize;function setPlayerSize(){var containerWidth=container.clientWidth;var containerHeight=container.clientHeight;if(!videowidth||!videoheight)
return;var width,height;switch(rotation){case 0:case 180:width=videowidth;height=videoheight;break;case 90:case 270:width=videoheight;height=videowidth;}
var xscale=containerWidth/width;var yscale=containerHeight/height;var scale=Math.min(xscale,yscale);width*=scale;height*=scale;var left=((containerWidth-width)/2);var top=((containerHeight-height)/2);var transform;switch(rotation){case 0:transform='translate('+left+'px,'+top+'px)';break;case 90:transform='translate('+(left+width)+'px,'+top+'px) '+'rotate(90deg)';break;case 180:transform='translate('+(left+width)+'px,'+(top+height)+'px) '+'rotate(180deg)';break;case 270:transform='translate('+left+'px,'+(top+height)+'px) '+'rotate(270deg)';break;}
transform+=' scale('+scale+')';poster.style.transform=transform;player.style.transform=transform;}
function setPlayerOrientation(newOrientation){orientation=newOrientation;}
function computePosition(panPosition,rect){var position;switch(orientation){case 0:position=(panPosition.clientX-rect.left)/rect.width;break;case 90:position=(rect.bottom-panPosition.clientY)/rect.height;break;case 180:position=(rect.right-panPosition.clientX)/rect.width;break;case 270:position=(panPosition.clientY-rect.top)/rect.height;break;}
return position;}
slider.addEventListener('pan',function pan(e){e.stopPropagation();if(player.duration===Infinity)
return;if(!dragging){dragging=true;pausedBeforeDragging=player.paused;if(!pausedBeforeDragging){player.pause();}}
var rect=backgroundBar.getBoundingClientRect();var position=computePosition(e.detail.position,rect);var pos=Math.min(Math.max(position,0),1);if(navigator.mozL10n.language.direction==='rtl'){pos=1-pos;}
player.currentTime=player.duration*pos;updateTime();});slider.addEventListener('swipe',function swipe(e){e.stopPropagation();dragging=false;if(player.currentTime>=player.duration){self.pause();}else if(!pausedBeforeDragging){player.play();}});slider.addEventListener('keypress',function(e){var step=Math.max(player.duration/20,2);if(e.keyCode==e.DOM_VK_DOWN){player.currentTime-=step;}else if(e.keyCode==e.DOM_VK_UP){player.currentTime+=step;}});function formatTime(time){time=Math.round(time);var minutes=Math.floor(time/60);var seconds=time%60;if(minutes<60){return Format.padLeft(minutes,2,'0')+':'+
Format.padLeft(seconds,2,'0');}else{var hours=Math.floor(minutes/60);minutes=Math.round(minutes%60);return hours+':'+Format.padLeft(minutes,2,'0')+':'+
Format.padLeft(seconds,2,'0');}
return'';}
this.localize=function(){var label;var portrait=videowidth<videoheight;if(rotation==90||rotation==270){portrait=!portrait;}
var orientation=navigator.mozL10n.get(portrait?'orientationPortrait':'orientationLandscape');if(videotimestamp){var locale_entry=navigator.mozL10n.get('videoDescription',{orientation:orientation});if(!self.dtf){self.dtf=new navigator.mozL10n.DateTimeFormat();}
label=self.dtf.localeFormat(videotimestamp,locale_entry);}else{label=navigator.mozL10n.get('videoDescriptionNoTimestamp',{orientation:orientation});}
poster.setAttribute('aria-label',label);};}
VideoPlayer.prototype.hide=function(){this.controls.style.display='none';};VideoPlayer.prototype.show=function(){this.controls.style.display='block';};VideoPlayer.instancesToLocalize=new WeakMap();navigator.mozL10n.ready(function(){for(var container of document.querySelectorAll('.video-player-container')){var instance=VideoPlayer.instancesToLocalize.get(container);if(instance){instance.localize();}}});