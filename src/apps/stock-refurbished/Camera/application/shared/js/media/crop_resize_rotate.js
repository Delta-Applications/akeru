
function cropResizeRotate(blob,cropRegion,outputSize,outputType,metadata,callback)
{'use strict';const JPEG='image/jpeg';const PNG='image/png';switch(arguments.length){case 2:callback=cropRegion;cropRegion=outputSize=outputType=metadata=null;break;case 3:callback=outputSize;outputSize=outputType=metadata=null;break;case 4:callback=outputType;outputType=metadata=null;break;case 5:callback=metadata;metadata=null;break;case 6:break;default:throw new Error('wrong number of arguments: '+arguments.length);}
if(cropRegion){cropRegion={left:cropRegion.left,top:cropRegion.top,width:cropRegion.width,height:cropRegion.height};}
if(outputSize&&typeof outputSize==='object'){outputSize={width:outputSize.width,height:outputSize.height};}
if(metadata){gotSize(metadata);}
else{getImageSize(blob,gotSize,function(msg){callback(msg);});}
function gotSize(metadata){var rawImageWidth=metadata.width;var rawImageHeight=metadata.height;var fullsize=rawImageWidth*rawImageHeight;var rotation=metadata.rotation||0;var mirrored=metadata.mirrored||false;var rotatedImageWidth,rotatedImageHeight;if(rotation===0||rotation===180){rotatedImageWidth=rawImageWidth;rotatedImageHeight=rawImageHeight;}
else{rotatedImageWidth=rawImageHeight;rotatedImageHeight=rawImageWidth;}
if(!cropRegion){cropRegion={left:0,top:0,width:rotatedImageWidth,height:rotatedImageHeight};}
else{if(cropRegion.left<0||cropRegion.top<0||(cropRegion.left+cropRegion.width>rotatedImageWidth)||(cropRegion.top+cropRegion.height>rotatedImageHeight)){callback('crop region does not fit inside image');return;}}
if(outputSize===null||outputSize===undefined){outputSize={width:cropRegion.width,height:cropRegion.height};}
else if(typeof outputSize==='number'){if(outputSize<=0){callback('outputSize must be positive');return;}
if(fullsize<outputSize){outputSize={width:cropRegion.width,height:cropRegion.height};}
else{var ds=Downsample.areaAtLeast(outputSize/fullsize);outputSize={width:ds.scale(cropRegion.width),height:ds.scale(cropRegion.height)};}}
if(!(outputSize.width>0&&outputSize.height>0)){callback('outputSize width and height must be positive');return;}
if(outputSize.width>cropRegion.width){outputSize.width=cropRegion.width;}
if(outputSize.height>cropRegion.height){outputSize.height=cropRegion.height;}
var scaleX=outputSize.width/cropRegion.width;var scaleY=outputSize.height/cropRegion.height;if(scaleY>scaleX){var oldCropWidth=cropRegion.width;cropRegion.width=Math.round(outputSize.width/scaleY);cropRegion.left+=(oldCropWidth-cropRegion.width)>>1;}
else if(scaleX>scaleY){var oldCropHeight=cropRegion.height;cropRegion.height=Math.round(outputSize.height/scaleX);cropRegion.top+=(oldCropHeight-cropRegion.height)>>1;}
if(outputType&&outputType!==JPEG&&outputType!==PNG){callback('unsupported outputType: '+outputType);return;}
if(rotation===0&&!mirrored&&(!outputType||blob.type===outputType)&&outputSize.width===rawImageWidth&&outputSize.height==rawImageHeight){callback(null,blob);return;}
var inputCropRegion;switch(rotation){case 180:inputCropRegion={left:rawImageWidth-cropRegion.left-cropRegion.width,top:rawImageHeight-cropRegion.top-cropRegion.height,width:cropRegion.width,height:cropRegion.height};break;case 90:inputCropRegion={left:cropRegion.top,top:rawImageHeight-cropRegion.left-cropRegion.width,width:cropRegion.height,height:cropRegion.width};break;case 270:inputCropRegion={left:rawImageWidth-cropRegion.top-cropRegion.height,top:cropRegion.left,width:cropRegion.height,height:cropRegion.width};break;default:inputCropRegion={left:cropRegion.left,top:cropRegion.top,width:cropRegion.width,height:cropRegion.height};break;}
if(mirrored){if(rotation===90||rotation===270){inputCropRegion.top=rawImageHeight-inputCropRegion.top-inputCropRegion.height;}
else{inputCropRegion.left=rawImageWidth-inputCropRegion.left-inputCropRegion.width;}}
var baseURL=URL.createObjectURL(blob);var croppedsize=cropRegion.width*cropRegion.height;var sampledsize;var downsample;if(blob.type===JPEG){downsample=Downsample.sizeNoMoreThan(outputSize.width/cropRegion.width);sampledsize=downsample.scale(rawImageWidth)*downsample.scale(rawImageHeight);}
else{downsample=Downsample.NONE;sampledsize=fullsize;}
var url;var croppedWithMediaFragment=false,resizedWithMediaFragment=false;if(sampledsize<fullsize){url=baseURL+downsample;resizedWithMediaFragment=true;}
else if(croppedsize<fullsize){url=baseURL+'#xywh='+
inputCropRegion.left+','+
inputCropRegion.top+','+
inputCropRegion.width+','+
inputCropRegion.height;croppedWithMediaFragment=true;}
else{url=baseURL;}
var offscreenImage=new Image();offscreenImage.src=url;offscreenImage.onerror=function(){callback('error decoding image: '+url);};offscreenImage.onload=gotImage;function gotImage(){if(croppedWithMediaFragment){if(offscreenImage.width===inputCropRegion.width&&offscreenImage.height===inputCropRegion.height){inputCropRegion.left=inputCropRegion.top=0;}}
else if(resizedWithMediaFragment){if(offscreenImage.width<rawImageWidth||offscreenImage.height<rawImageHeight){var sampleSizeX=rawImageWidth/offscreenImage.width;var sampleSizeY=rawImageHeight/offscreenImage.height;inputCropRegion.left=Math.round(inputCropRegion.left/sampleSizeX);inputCropRegion.top=Math.round(inputCropRegion.top/sampleSizeY);inputCropRegion.width=Math.round(inputCropRegion.width/sampleSizeX);inputCropRegion.height=Math.round(inputCropRegion.height/sampleSizeY);}}
var canvas=document.createElement('canvas');var destWidth=canvas.width=outputSize.width;var destHeight=canvas.height=outputSize.height;var context=canvas.getContext('2d',{willReadFrequently:true});if(rotation||mirrored){context.translate(canvas.width/2,canvas.height/2);if(mirrored){context.scale(-1,1);}
switch(rotation){case 90:context.rotate(Math.PI/2);destWidth=canvas.height;destHeight=canvas.width;break;case 180:context.rotate(Math.PI);break;case 270:context.rotate(-Math.PI/2);destWidth=canvas.height;destHeight=canvas.width;break;}
if(rotation===90||rotation===270){context.translate(-canvas.height/2,-canvas.width/2);}
else{context.translate(-canvas.width/2,-canvas.height/2);}}
try{context.drawImage(offscreenImage,inputCropRegion.left,inputCropRegion.top,inputCropRegion.width,inputCropRegion.height,0,0,destWidth,destHeight);}
catch(e){callback('Failed to decode image in cropResizeRotate; '+'image may be corrupt or too large: '+e);return;}
finally{offscreenImage.src='';URL.revokeObjectURL(baseURL);}
canvas.toBlob(gotEncodedBlob,outputType||JPEG);function gotEncodedBlob(blob){canvas.width=canvas.height=0;canvas=context=null;callback(null,blob);}}}}