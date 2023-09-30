
(function(exports){'use strict';var ImageUtils=exports.ImageUtils={};const JPEG='image/jpeg';const PNG='image/png';const GIF='image/gif';const BMP='image/bmp';ImageUtils.JPEG=JPEG;ImageUtils.PNG=PNG;ImageUtils.GIF=GIF;ImageUtils.BMP=BMP;ImageUtils.getSizeAndType=function getSizeAndType(imageBlob){if(!(imageBlob instanceof Blob)){return Promise.reject(new TypeError('argument is not a Blob'));}
return new Promise(function(resolve,reject){if(imageBlob.size<=16){reject('corrupt image file');return;}
var bytesToRead=32*1024;if(imageBlob.type===PNG||imageBlob.type===GIF||imageBlob.type===BMP){bytesToRead=512;}
findSizeAndType(imageBlob,bytesToRead,success,tryagain);function success(data){resolve(data);}
function tryagain(data){if(data.type===JPEG){findSizeAndType(imageBlob,imageBlob.size,success,failure);}
else{reject(data.error);}}
function failure(data){reject(data.error);}});function findSizeAndType(imageBlob,amountToRead,success,failure){var slice=imageBlob.slice(0,Math.min(amountToRead,imageBlob.size));var reader=new FileReader();reader.readAsArrayBuffer(slice);reader.onloadend=function(){parseImageData(reader.result);};function parseImageData(buffer){var header=new Uint8Array(buffer,0,16);var view=new DataView(buffer);if(header[0]===0x89&&header[1]===0x50&&header[2]===0x4e&&header[3]===0x47&&header[4]===0x0d&&header[5]===0x0a&&header[6]===0x1A&&header[7]===0x0a&&header[12]===0x49&&header[13]===0x48&&header[14]===0x44&&header[15]===0x52)
{try{success({type:PNG,width:view.getUint32(16,false),height:view.getUint32(20,false)});}
catch(ex){failure({error:ex.toString()});}}
else if(header[0]===0x47&&header[1]===0x49&&header[2]===0x46&&header[3]===0x38&&(header[4]===0x37||header[4]===0x39)&&header[5]===0x61)
{try{success({type:GIF,width:view.getUint16(6,true),height:view.getUint16(8,true)});}
catch(ex){failure({error:ex.toString()});}}
else if(header[0]===0x42&&header[1]===0x4D&&view.getUint32(2,true)===imageBlob.size)
{try{var width,height;if(view.getUint16(14,true)===12){width=view.getUint16(18,true);height=view.getUint16(20,true);}
else{width=view.getUint32(18,true);height=view.getUint32(22,true);}
success({type:BMP,width:width,height:height});}
catch(ex){failure({error:ex.toString()});}}
else if(header[0]===0xFF&&header[1]===0xD8){var value={type:JPEG};try{var offset=2;for(;;){if(view.getUint8(offset)!==0xFF){failure({error:'corrupt JPEG file'});}
var segmentType=view.getUint8(offset+1);var segmentSize=view.getUint16(offset+2)+2;if((segmentType>=0xC0&&segmentType<=0xC3)||(segmentType>=0xC5&&segmentType<=0xC7)||(segmentType>=0xC9&&segmentType<=0xCB)||(segmentType>=0xCD&&segmentType<=0xCF))
{value.height=view.getUint16(offset+5,false);value.width=view.getUint16(offset+7,false);success(value);break;}
offset+=segmentSize;if(offset+9>view.byteLength){value.error='corrupt JPEG file';failure(value);break;}}}
catch(ex){failure({error:ex.toString()});}}
else{failure({error:'unknown image type'});}}}};ImageUtils.resizeAndCropToCover=function(inputImageBlob,outputWidth,outputHeight,outputType,encoderOptions)
{if(!outputWidth||!isFinite(outputWidth)||outputWidth<=0||!outputHeight||!isFinite(outputHeight)||outputHeight<=0){return Promise.reject(new TypeError('invalid output dimensions'));}
outputWidth=Math.round(outputWidth);outputHeight=Math.round(outputHeight);return ImageUtils.getSizeAndType(inputImageBlob).then(function resolve(data){var inputWidth=data.width;var inputHeight=data.height;if(inputWidth===outputWidth&&inputHeight===outputHeight){return inputImageBlob;}
return resize(data);},function reject(error){return resize({});});function resize(data){var inputType=data.type;var inputWidth=data.width;var inputHeight=data.height;if(outputType&&outputType!==JPEG&&outputType!==PNG){console.warn('Ignoring unsupported outputType',outputType);outputType=undefined;}
if(!outputType){if(inputType===JPEG||inputType===PNG){outputType=inputType;}
else{outputType=PNG;}}
var url=URL.createObjectURL(inputImageBlob);var mediaFragment;if(inputType===JPEG&&inputWidth>outputWidth&&inputHeight>outputHeight){var reduction=Math.max(outputWidth/inputWidth,outputHeight/inputHeight);mediaFragment=ImageUtils.Downsample.sizeNoMoreThan(reduction);}
else{mediaFragment='';}
return new Promise(function(resolve,reject){var offscreenImage=new Image();offscreenImage.src=url+mediaFragment;offscreenImage.onerror=function(e){cleanupImage();reject('failed to decode image');};offscreenImage.onload=function(){var actualWidth=offscreenImage.width;var actualHeight=offscreenImage.height;var widthScale=outputWidth/actualWidth;var heightScale=outputHeight/actualHeight;var scale=Math.max(widthScale,heightScale);var cropWidth=Math.round(outputWidth/scale);var cropHeight=Math.round(outputHeight/scale);var cropLeft=Math.floor((actualWidth-cropWidth)/2);var cropTop=Math.floor((actualHeight-cropHeight)/2);var canvas=document.createElement('canvas');canvas.width=outputWidth;canvas.height=outputHeight;var context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(offscreenImage,cropLeft,cropTop,cropWidth,cropHeight,0,0,outputWidth,outputHeight);cleanupImage();canvas.toBlob(function(blob){canvas.width=0;resolve(blob);},outputType,encoderOptions);};function cleanupImage(){offscreenImage.onerror=offscreenImage.onload='';offscreenImage.src='';URL.revokeObjectURL(url);}});}};(function(exports){'use strict';function round(x){return Math.round(x*100)/100;}
function MozSampleSize(n,scale){return Object.freeze({dimensionScale:round(scale),areaScale:round(scale*scale),toString:function(){return'#-moz-samplesize='+n;},scale:function(x){return Math.ceil(x*scale);}});}
var NONE=Object.freeze({dimensionScale:1,areaScale:1,toString:function(){return'';},scale:function(x){return x;}});var fragments=[NONE,MozSampleSize(2,1/2),MozSampleSize(3,3/8),MozSampleSize(4,1/4),MozSampleSize(8,1/8)];function sizeAtLeast(scale){scale=round(scale);for(var i=0;i<fragments.length;i++){var f=fragments[i];if(f.dimensionScale<=scale){return f;}}
return fragments[fragments.length-1];}
function sizeNoMoreThan(scale){scale=round(scale);for(var i=fragments.length-1;i>=0;i--){var f=fragments[i];if(f.dimensionScale>=scale){return f;}}
return NONE;}
function areaAtLeast(scale){scale=round(scale);for(var i=0;i<fragments.length;i++){var f=fragments[i];if(f.areaScale<=scale){return f;}}
return fragments[fragments.length-1];}
function areaNoMoreThan(scale){scale=round(scale);for(var i=fragments.length-1;i>=0;i--){var f=fragments[i];if(f.areaScale>=scale){return f;}}
return NONE;}
exports.Downsample={sizeAtLeast:sizeAtLeast,sizeNoMoreThan:sizeNoMoreThan,areaAtLeast:areaAtLeast,areaNoMoreThan:areaNoMoreThan,NONE:NONE,MAX_SIZE_REDUCTION:1/fragments[fragments.length-1].dimensionScale,MAX_AREA_REDUCTION:1/fragments[fragments.length-1].areaScale};}(exports.ImageUtils));})(window);