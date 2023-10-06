
(function(exports){'use strict';function ah_getCompatible(list,mcc,mnc,type){var apns=list[mcc]?(list[mcc][mnc]||[]):[];return apns;}
function ah_getAll(list,mcc,mnc){var apns=list[mcc]?(list[mcc][mnc]||[]):[];return apns;}
var ApnHelper={getCompatible:ah_getCompatible,getAll:ah_getAll};exports.ApnHelper=ApnHelper;})(this);