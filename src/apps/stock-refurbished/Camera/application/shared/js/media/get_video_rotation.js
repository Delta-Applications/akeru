'use strict';function getVideoRotation(blob,rotationCallback){function MP4Parser(blob,handlers){BlobView.get(blob,0,Math.min(1024,blob.size),function(data,error){if(data.byteLength<=8||data.getASCIIText(4,4)!=='ftyp'){handlers.errorHandler('not an MP4 file');return;}
parseAtom(data);});function parseAtom(data){var offset=data.sliceOffset+data.viewOffset;var size=data.readUnsignedInt();var type=data.readASCIIText(4);var contentOffset=8;if(size===0){size=blob.size-offset;}
else if(size===1){size=data.readUnsignedInt()*4294967296+data.readUnsignedInt();contentOffset=16;}
var handler=handlers[type]||handlers.defaultHandler;if(typeof handler==='function'){data.getMore(data.sliceOffset+data.viewOffset,size,function(atom){var rv=handler(atom);if(rv!=='done'){parseAtomAt(data,offset+size);}});}
else if(handler==='children'){var skip=(type==='meta')?4:0;parseAtomAt(data,offset+contentOffset+skip);}
else if(handler==='skip'||!handler){parseAtomAt(data,offset+size);}
else if(handler==='done'){return;}}
function parseAtomAt(data,offset){if(offset>=blob.size){if(handlers.eofHandler)
handlers.eofHandler();return;}
else{data.getMore(offset,16,parseAtom);}}}
MP4Parser(blob,{errorHandler:function(msg){rotationCallback(msg);},eofHandler:function(){rotationCallback(null);},defaultHandler:'skip',moov:'children',trak:'children',tkhd:function(data){data.advance(48);var a=data.readUnsignedInt();var b=data.readUnsignedInt();data.advance(4);var c=data.readUnsignedInt();var d=data.readUnsignedInt();if(a===0&&d===0){if(b===0x00010000&&c===0xFFFF0000)
rotationCallback(90);else if(b===0xFFFF0000&&c===0x00010000)
rotationCallback(270);else
rotationCallback('unexpected rotation matrix');}
else if(b===0&&c===0){if(a===0x00010000&&d===0x00010000)
rotationCallback(0);else if(a===0xFFFF0000&&d===0xFFFF0000)
rotationCallback(180);else
rotationCallback('unexpected rotation matrix');}
else{rotationCallback('unexpected rotation matrix');}
return'done';}});}