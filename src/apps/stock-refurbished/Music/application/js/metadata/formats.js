var MetadataFormats=function(){function e(e){this._formatInfo=e}function t(t){for(var r=0;r<n.length;r++)if(n[r].match(t))return new e(n[r]);return null}var n=[{file:"js/metadata/id3v2.js",get module(){return ID3v2Metadata},match:function(e){return"ID3"===e.getASCIIText(0,3)}},{file:"js/metadata/ogg.js",get module(){return OggMetadata},match:function(e){return"OggS"===e.getASCIIText(0,4)}},{file:"js/metadata/flac.js",get module(){return FLACMetadata},match:function(e){return"fLaC"===e.getASCIIText(0,4)}},{file:"js/metadata/mp4.js",get module(){return MP4Metadata},match:function(e){return"ftyp"===e.getASCIIText(4,4)}},{file:"js/metadata/id3v1.js",get module(){return ID3v1Metadata},match:function(e){return 65522===(65526&e.getUint16(0,!1))}}];return e.prototype={parse:function(e,t){var n=this._formatInfo;return new Promise(function(r){LazyLoader.load(n.file,function(){r(n.module.parse(e,t))})})}},{findParser:t}}();