function onLoadCallScreen(){window.removeEventListener("load",onLoadCallScreen);window.libSession.initService(["settingsService","powerService","devicecapabilityService","audiovolumeService","contactsService"]).then(()=>{SettingsObserver.init(),CallsHandler.setup(),CallScreen.init(),DtmfHelper.init(),LockScreen.init(),TonePlayer.init(),SdnContacts.init()}),navigator.serviceWorker.addEventListener("message",e=>{e=new CustomEvent(e.data.type,{detail:{data:e.data.data||null}});window.dispatchEvent(e)})}window.addEventListener("load",onLoadCallScreen),window.addEventListener("hashchange",()=>{window.performance.mark("openCallscreen-end"),window.performance.clearMarks("openCallscreen-end")});