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
                // mgmt.import
                this.activityRequest.postError('NO PROVIDER');
                window.close();
                break;
        }
    }
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