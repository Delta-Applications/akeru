'use strict';function getStorageIfAvailable(kind,size,success,error){var storage=navigator.getDeviceStorage(kind);storage.available().onsuccess=function(e){if(e.target.result!=='available'){if(error){error(e.target.result);}}
else{storage.freeSpace().onsuccess=function(e){if(e.target.result<size){if(error){error(e.target.result);}}
else{success(storage);}};}};}