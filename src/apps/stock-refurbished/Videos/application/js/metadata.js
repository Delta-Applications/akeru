
var metadataQueue=[];var processingQueue=false;var stopParsingMetadataCallback=null;var noMoreWorkCallback=null;function addToMetadataQueue(fileinfo){metadataQueue.push(fileinfo);startParsingMetadata();}
function startParsingMetadata(){if(processingQueue)
return;if(metadataQueue.length===0){if(noMoreWorkCallback){noMoreWorkCallback();noMoreWorkCallback=null;}
return;}
if(document.hidden||playerShowing){return;}
processingQueue=true;processFirstQueuedItem();}
function stopParsingMetadata(callback){if(!processingQueue){if(callback)
callback();return;}
stopParsingMetadataCallback=callback||true;}
function processFirstQueuedItem(){if(stopParsingMetadataCallback){var callback=stopParsingMetadataCallback;stopParsingMetadataCallback=null;processingQueue=false;if(callback!==true)
callback();return;}
if(metadataQueue.length===0){processingQueue=false;if(typeof(noMoreWorkCallback)==='function'){noMoreWorkCallback();}
return;}
var fileinfo=metadataQueue.shift();videodb.getFile(fileinfo.name,function(file){getMetadata(file,function(metadata){fileinfo.metadata=metadata;videodb.updateMetadata(fileinfo.name,metadata,function(){if(metadata.isVideo){videodb.getFileInfo(fileinfo.name,function(dbfileinfo){addVideo(dbfileinfo);processFirstQueuedItem();});}else{processFirstQueuedItem();}});});},function(err){console.error('getFile error: ',fileinfo.name,err);processFirstQueuedItem();});}
function getMetadata(videofile,callback){var offscreenVideo=document.createElement('video');var metadata={};if(!offscreenVideo.canPlayType(videofile.type)){metadata.isVideo=false;callback(metadata);return;}
var url=URL.createObjectURL(videofile);offscreenVideo.preload='metadata';offscreenVideo.src=url;offscreenVideo.onerror=function(e){console.error("Can't play video",videofile.name,e);metadata.isVideo=false;unload();callback(metadata);};offscreenVideo.onloadedmetadata=function(){if(!offscreenVideo.videoWidth){metadata.isVideo=false;unload();callback(metadata);return;}
metadata.isVideo=true;metadata.title=readFromMetadata('title')||fileNameToVideoName(videofile.name);metadata.duration=offscreenVideo.duration;metadata.width=offscreenVideo.videoWidth;metadata.height=offscreenVideo.videoHeight;if(/.3gp$/.test(videofile.name)){getVideoRotation(videofile,function(rotation){if(typeof rotation==='number')
metadata.rotation=rotation;else if(typeof rotation==='string')
console.warn('Video rotation:',rotation);createThumbnail();});}else{metadata.rotation=0;createThumbnail();}};function readFromMetadata(lowerCaseKey){var tags=offscreenVideo.mozGetMetadata();for(var key in tags){if(key.toLowerCase()===lowerCaseKey){return tags[key];}}
return;}
function createThumbnail(){offscreenVideo.fastSeek(0);var failed=false;var timeout=setTimeout(fail,10000);offscreenVideo.onerror=fail;function fail(){console.warn('Seek failed while creating thumbnail for',videofile.name,'. Ignoring corrupt file.');failed=true;clearTimeout(timeout);offscreenVideo.onerror=null;metadata.isVideo=false;unload();callback(metadata);}
offscreenVideo.onseeked=function(){if(failed)
return;clearTimeout(timeout);captureFrame(offscreenVideo,metadata,function(poster){metadata.poster=poster;unload();callback(metadata);});};}
function unload(){URL.revokeObjectURL(url);URL.revokeObjectURL(offscreenVideo.src);offscreenVideo.removeAttribute('src');offscreenVideo.load();}
function fileNameToVideoName(filename){filename=filename.split('/').pop().replace(/\.(webm|ogv|ogg|mp4|3gp)$/i,'');return filename.charAt(0).toUpperCase()+filename.slice(1);}}
function captureFrame(player,metadata,callback){try{var canvas=document.createElement('canvas');canvas.width=THUMBNAIL_WIDTH;canvas.height=THUMBNAIL_HEIGHT;var ctx=canvas.getContext('2d',{willReadFrequently:true});var vw=player.videoWidth,vh=player.videoHeight;var tw,th;var scale=Math.min(tw/vw,th/vh),w=scale*vw,h=scale*vh,x=(tw-w)/2/scale,y=(th-h)/2/scale;ctx.drawImage(player,0,0,canvas.width,canvas.height);canvas.toBlob(done,'image/jpeg');}
catch(e){console.error('Exception in captureFrame:',e,e.stack);done(null);}
function done(blob){canvas.width=0;ctx=canvas=null;callback(blob);}}