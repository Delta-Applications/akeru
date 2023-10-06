
(function(exports){'use strict';var NUMBER_OF_DECIMALS=1;var BYTE_SCALE=['B','KB','MB','GB','TB'];function _getFormattedSize(bytes){if(bytes===undefined||isNaN(bytes)){return null;}
var index=0;while(bytes>=1024&&index<BYTE_SCALE.length){bytes/=1024;++index;}
var _=navigator.mozL10n.get;return _('fileSize',{size:bytes.toFixed(NUMBER_OF_DECIMALS),unit:_('byteUnit-'+BYTE_SCALE[index])});}
function _calcPercentage(currently,total){if(total===0){return 0;}
return parseInt((100*currently)/total);}
var DownloadFormatter={getFormattedSize:function(bytes){return _getFormattedSize(bytes);},getPercentage:function(download){return _calcPercentage(download.currentBytes,download.totalBytes);},getFileName:function(download){return download.path.split('/').pop();},getTotalSize:function(download){var bytes=download.totalBytes;return _getFormattedSize(bytes);},getDownloadedSize:function(download){var bytes=download.currentBytes;return _getFormattedSize(bytes);},getDate:function(download,callback){var date;try{date=download.startTime;}catch(ex){date=new Date();console.error(ex);}
LazyLoader.load(['shared/js/l10n_date.js'],function onload(){var prettyDate=navigator.mozL10n.DateTimeFormat().fromNow(date);callback&&callback(prettyDate);});},getUUID:function(download){return download.id||this.getFileName(download);}};exports.DownloadFormatter=DownloadFormatter;}(this));