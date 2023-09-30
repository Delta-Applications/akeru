
(function(exports){'use strict';function round(x){return Math.round(x*100)/100;}
function MozSampleSize(n,scale){return Object.freeze({dimensionScale:round(scale),areaScale:round(scale*scale),toString:function(){return'#-moz-samplesize='+n;},scale:function(x){return Math.ceil(x*scale);}});}
var NONE=Object.freeze({dimensionScale:1,areaScale:1,toString:function(){return'';},scale:function(x){return x;}});var fragments=[NONE,MozSampleSize(2,1/2),MozSampleSize(3,3/8),MozSampleSize(4,1/4),MozSampleSize(8,1/8)];function sizeAtLeast(scale){scale=round(scale);for(var i=0;i<fragments.length;i++){var f=fragments[i];if(f.dimensionScale<=scale){return f;}}
return fragments[fragments.length-1];}
function sizeNoMoreThan(scale){scale=round(scale);for(var i=fragments.length-1;i>=0;i--){var f=fragments[i];if(f.dimensionScale>=scale){return f;}}
return NONE;}
function areaAtLeast(scale){scale=round(scale);for(var i=0;i<fragments.length;i++){var f=fragments[i];if(f.areaScale<=scale){return f;}}
return fragments[fragments.length-1];}
function areaNoMoreThan(scale){scale=round(scale);for(var i=fragments.length-1;i>=0;i--){var f=fragments[i];if(f.areaScale>=scale){return f;}}
return NONE;}
exports.Downsample={sizeAtLeast:sizeAtLeast,sizeNoMoreThan:sizeNoMoreThan,areaAtLeast:areaAtLeast,areaNoMoreThan:areaNoMoreThan,NONE:NONE,MAX_SIZE_REDUCTION:1/fragments[fragments.length-1].dimensionScale,MAX_AREA_REDUCTION:1/fragments[fragments.length-1].areaScale};}(window));