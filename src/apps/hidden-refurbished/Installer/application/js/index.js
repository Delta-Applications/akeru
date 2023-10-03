'use strict';
const Installer = {
    filetypes: ["application/zip", "application/x-install-bundle", "application/x-gerda-bundle", "application/openwebapp+zip"],
    init() {
        navigator.mozSetMessageHandler('activity', this.activityHandler.bind(this));
    },
    activityHandler(request) {
        if (request.source.name === "open" | request.source.name === "install") {
            this.install(request.source)
        }
    },
    pickActivity() {

    },
    install(source) {
        // Replace confirm with gaia-confirm
        let blob = option.data.blob
        let fileName = blob.name

        if(!window.confirm('Do you wish to install this package: '+fileName+'?')) {
            activityRequest.postResult(false)
        }

        switch (option.data.type) {
            case "application/zip":
            case "application/openwebapp+zip":
                this.mozAppsImport(blob, (success, name, message) => {if (!success) window.alert('Installation error: ' + name + ' ' + message) })
                window.close();
                break;
            default:
                window.alert("Package unsupported")
                window.close();
                break;
        }
    },
    //mozApps.mgmt.import
    mozAppsImport(blob, callback) {
        navigator.mozApps.mgmt.import(blob).then(function(){
            callback(true)
          }).catch(e=>{
            callback(false, e.name, e.message)
          })
    },
};
window.installer = Installer;
Installer.init();

navigator.mozSetMessageHandler('activity', function(activityRequest) {
    let option = activityRequest.source
    if(option.name === 'open' && option.data.type === 'application/zip') {
      document.body.style.background = 'var(--accent-color)'
      document.querySelector("#header").style.display = 'none'
      document.querySelector("#finder").style.background = 'var(--accent-color)'
      document.querySelector("#finder").style.display = 'none'
      let blob = option.data.blob
      let fileName = blob.name
      if(window.confirm('Install '+fileName+' package?')) {
          KaiRoot.internal.sideload(blob, function(result) {
            activityRequest.postResult(result)
          })
      }else activityRequest.postResult(true)
    }
  })