'use strict';function parseJPEGMetadata(file,metadataCallback,metadataError){var metadata={};BlobView.get(file,0,Math.min(16*1024,file.size),function(data){if(data.byteLength<2||data.getUint8(0)!==0xFF||data.getUint8(1)!==0xD8){metadataError('Not a JPEG file');return;}
getSegment(data,2,segmentHandler);});function getSegment(data,offset,callback){try{var header=data.getUint8(offset);if(header!==0xFF){metadataError('Malformed JPEG file: bad segment header');return;}
var type=data.getUint8(offset+1);var size=data.getUint16(offset+2)+2;var start=data.sliceOffset+data.viewOffset+offset;var isLast=(start+size>=file.size);var length=isLast?size:size+4;data.getMore(start,length,function(data){callback(type,size,data,isLast);});}
catch(e){metadataError(e.toString()+'\n'+e.stack);}}
function segmentHandler(type,size,data,isLastSegment){try{switch(type){case 0xC0:case 0xC1:case 0xC2:case 0xC3:metadata.height=data.getUint16(5);metadata.width=data.getUint16(7);if(type===0xC2){metadata.progressive=true;}
metadataCallback(metadata);break;case 0xE1:parseAPP1(data);default:if(isLastSegment){metadataError('unexpected end of JPEG file');return;}
getSegment(data,size,segmentHandler);}}
catch(e){metadataError(e.toString()+'\n'+e.stack);}}
function parseAPP1(data){if(data.getUint32(4,false)===0x45786966){var exif=parseEXIFData(data);if(exif.THUMBNAIL&&exif.THUMBNAILLENGTH){var start=data.sliceOffset+data.viewOffset+10+exif.THUMBNAIL;metadata.preview={start:start,end:start+exif.THUMBNAILLENGTH};}
switch(exif.ORIENTATION){case 1:default:metadata.rotation=0;metadata.mirrored=false;break;case 2:metadata.rotation=0;metadata.mirrored=true;break;case 3:metadata.rotation=180;metadata.mirrored=false;break;case 4:metadata.rotation=180;metadata.mirrored=true;break;case 5:metadata.rotation=90;metadata.mirrored=true;break;case 6:metadata.rotation=90;metadata.mirrored=false;break;case 7:metadata.rotation=270;metadata.mirrored=true;break;case 8:metadata.rotation=270;metadata.mirrored=false;break;}}}
function parseEXIFData(data){var exif={};var byteorder=data.getUint8(10);if(byteorder===0x4D){byteorder=false;}else if(byteorder===0x49){byteorder=true;}else{throw Error('invalid byteorder in EXIF segment');}
if(data.getUint16(12,byteorder)!==42){throw Error('bad magic number in EXIF segment');}
var offset=data.getUint32(14,byteorder);parseIFD(data,offset+10,byteorder,exif,true);var ifd0entries=data.getUint16(offset+10,byteorder);var ifd1=data.getUint32(offset+12+12*ifd0entries,byteorder);if(ifd1!==0)
parseIFD(data,ifd1+10,byteorder,exif,true);return exif;}
function parseIFD(data,offset,byteorder,exif,onlyParseOne){var numentries=data.getUint16(offset,byteorder);for(var i=0;i<numentries;i++){parseEntry(data,offset+2+12*i,byteorder,exif);}
if(onlyParseOne)
return;var next=data.getUint32(offset+2+12*numentries,byteorder);if(next!==0&&next<file.size){parseIFD(data,next+10,byteorder,exif);}}
var typesize=[0,1,1,2,4,8,1,1,2,4,8,4,8];var tagnames={'274':'ORIENTATION','513':'THUMBNAIL','514':'THUMBNAILLENGTH'};function parseEntry(data,offset,byteorder,exif){var tag=data.getUint16(offset,byteorder);var tagname=tagnames[tag];if(!tagname||exif[tagname])
return;var type=data.getUint16(offset+2,byteorder);var count=data.getUint32(offset+4,byteorder);var total=count*typesize[type];var valueOffset=total<=4?offset+8:data.getUint32(offset+8,byteorder);exif[tagname]=parseValue(data,valueOffset,type,count,byteorder);}
function parseValue(data,offset,type,count,byteorder){if(type===2){var codes=[];for(var i=0;i<count-1;i++){codes[i]=data.getUint8(offset+i);}
return String.fromCharCode.apply(String,codes);}else{if(count==1){return parseOneValue(data,offset,type,byteorder);}else{var values=[];var size=typesize[type];for(var i=0;i<count;i++){values[i]=parseOneValue(data,offset+size*i,type,byteorder);}
return values;}}}
function parseOneValue(data,offset,type,byteorder){switch(type){case 1:case 7:return data.getUint8(offset);case 2:return null;case 3:return data.getUint16(offset,byteorder);case 4:return data.getUint32(offset,byteorder);case 5:return data.getUint32(offset,byteorder)/data.getUint32(offset+4,byteorder);case 6:return data.getInt8(offset);case 8:return data.getInt16(offset,byteorder);case 9:return data.getInt32(offset,byteorder);case 10:return data.getInt32(offset,byteorder)/data.getInt32(offset+4,byteorder);case 11:return data.getFloat32(offset,byteorder);case 12:return data.getFloat64(offset,byteorder);}
return null;}}