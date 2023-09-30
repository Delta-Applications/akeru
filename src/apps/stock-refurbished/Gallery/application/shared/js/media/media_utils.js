'use strict';var MediaUtils={_:navigator.mozL10n.get,formatDate:function(timestamp){if(!timestamp||timestamp===undefined||isNaN(timestamp)){return;}
var dtf=new navigator.mozL10n.DateTimeFormat();return dtf.localeFormat(new Date(timestamp),this._('dateTimeFormat_%x'));},formatSize:function(size){if(!size||size===undefined||isNaN(size)){return;}
var units=['B','KB','MB','GB','TB','PB','EB','ZB','YB'];var i=0;while(size>=1024&&i<(units.length-1)){size/=1024;++i;}
var sizeDecimal=i<2?Math.round(size):Math.round(size*10)/10;return sizeDecimal.toLocaleString(navigator.language)+' '+this._('byteUnit-'+units[i]);},formatDuration:function(duration){function padLeft(num,length){var r=String(num);while(r.length<length){r='0'+r;}
return r;}
duration=Math.round(duration);var minutes=Math.floor(duration/60);var seconds=duration%60;if(minutes<60){return padLeft(minutes,2)+':'+padLeft(seconds,2);}
var hours=Math.floor(minutes/60);minutes=Math.floor(minutes%60);return hours+':'+padLeft(minutes,2)+':'+padLeft(seconds,2);},populateMediaInfo:function(data){for(var id in data){if(data.hasOwnProperty(id)){var element=document.getElementById(id);if(element)
element.textContent=data[id];}}},binarySearch:function(array,element,comparator,from,to){if(comparator===undefined)
comparator=function(a,b){return a-b;};if(from===undefined)
return MediaUtils.binarySearch(array,element,comparator,0,array.length);if(from===to)
return from;var mid=Math.floor((from+to)/2);var result=comparator(element,array[mid]);if(result<0)
return MediaUtils.binarySearch(array,element,comparator,from,mid);else
return MediaUtils.binarySearch(array,element,comparator,mid+1,to);}};