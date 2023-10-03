'use strict';
const Installer = {
    filetypes: ["application/zip", "application/x-install-bundle", "application/x-gerda-bundle", "application/openwebapp+zip", "application/x-web-package"],
    init() {
        navigator.mozSetMessageHandler('activity', this.activityHandler.bind(this));
    },
    activityHandler(request) {
        if (request.source.name === "open" | request.source.name === "install") {
            this.install(request.source)
        }
    },
    pickActivity() {
        this.activityHandler(new MozActivity({
            name: "pick",
          }));
    },
    install(source) {
        // Replace confirm with gaia-confirm
        let blob = source.data.blob
        let fileName = blob.name

        if(!window.confirm('Do you wish to install this package: '+fileName+'?')) {
            activityRequest.postResult(false)
        }

        switch (source.data.type) {
            case "application/x-web-package":
                // WebIDE/KaiOS Store Format: self-debug > mozAppsImport > patching&reboot
            case "application/x-install-bundle":
                break;
            case "application/zip":
            case "application/openwebapp+zip":
                // OmniSD Format: mozAppsImport > self-debug > patching&reboot
                this.mozAppsImport(blob, (success, name, message) => {
                    // Attempt self-debug if unsuccessful
                    // Ask user before attempting patch & reboot if self-debug fails
                    if (!success) window.alert('Installation error: ' + name + ' ' + message) 
                })
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
window.Installer = Installer;
Installer.init();