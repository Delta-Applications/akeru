'use strict'; var Wallpaper = {
    thumbnailScale: 3 / 8, wallpapersUrl: '/resources/list.json', imageList: [], indexList: [], currentStep: 0, scrollVar: { block: "start", behavior: "smooth" }, init: function wallpaper_init() {
        var self = this; if (navigator.mozSetMessageHandler) {
            navigator.mozSetMessageHandler('activity', function handler(request) {
                var activityName = request.source.name; if (activityName !== 'pick') { return; }
                self.startPick(request);
            });
        }
        this.wallpapers = document.getElementById('wallpapers'); this.generateWallpaperList(); window.addEventListener("keydown", this.changFocus.bind(this));
    }, generateWallpaperList: function wallpaper_generateWallpaperList(cb) {
        var self = this; var sampleSize = Downsample.sizeNoMoreThan(this.thumbnailScale); console.log('wallpaper pick >>> get ro.boot.skuid...'); 
        
        this.wallpapersUrl = '/resources/list.json'; 

        LazyLoader.getJSON(this.wallpapersUrl).then(function (json) {
            self.wallpapers.innerHTML = ''; json.forEach(function (wallpaper) { var fileName = 'resources/' + wallpaper; var imgNode = document.createElement('img'); imgNode.alt = ''; imgNode.classList.add('wallpaper'); imgNode.dataset.filename = fileName; imgNode.src = fileName + sampleSize; self.wallpapers.appendChild(imgNode); }); if (cb) { cb(); }
            self.navigation();
        });
    }, navigation: function wallpaper_navigation() { this.imageList = this.wallpapers.querySelectorAll('img'); this.imageList[0].classList.add('focus'); this.currentStep = 0; for (var i = 1; i <= 3; i++) { var index = (this.imageList.length - i) % 3; this.indexList[index] = (this.imageList.length - i); } }, changFocus: function wallpaper_changFocus(evt) {
        var lineStep = 0; var conlumeStep = 0; switch (evt.key) { case "ArrowLeft": lineStep = -1; break; case "ArrowRight": lineStep = 1; break; case "ArrowUp": conlumeStep = -3; break; case "ArrowDown": conlumeStep = 3; break; default: return; }
        this.imageList[this.currentStep].classList.remove('focus'); if (conlumeStep == 0) {
            this.currentStep += lineStep; if (this.currentStep < 0) { this.currentStep = this.imageList.length - 1; }
            else if (this.currentStep > this.imageList.length - 1) { this.currentStep = 0; }
        }
        else {
            if (this.currentStep < 3 && conlumeStep < 0) { this.currentStep = this.indexList[this.currentStep]; }
            else if (this.currentStep >= this.imageList.length - 3 && conlumeStep > 0) { for (var i = 0; i <= 3; i++) { if (this.indexList[i] == this.currentStep) { this.currentStep = i; break; } } }
            else { this.currentStep += conlumeStep; }
        }
        this.imageList[this.currentStep].classList.add('focus'); this.imageList[this.currentStep].scrollIntoView(this.scrollVar);
    }, startPick: function wallpaper_startPick(request) { this.pickActivity = request; var self = this; var parames = { header: { l10nId: 'message' }, items: [{ name: 'Cancel', l10nId: 'cancel', priority: 1, method: function () { self.cancelPick(); } }, { name: 'Save', l10nId: 'save', priority: 3, method: function () { self.savePick(); } },] }; SoftkeyHelper.init(parames, self.cancelPick.bind(this)); }, savePick: function wallpaper_savePick() { var item = this.wallpapers.querySelector('.focus'); if (item) { this.pickWallpaper(item); } }, pickWallpaper: function wallpaper_pickWallpaper(target) {
        var src = target.dataset.filename; if (src === '') { return; }
        if (!this.pickActivity) { return; }
        var img = new Image(); img.src = src; var self = this; img.onload = function () { var canvas = document.createElement('canvas'); var context = canvas.getContext('2d'); canvas.width = img.width; canvas.height = img.height; context.drawImage(img, 0, 0); canvas.toBlob(function (blob) { self.pickActivity.postResult({ type: 'image/jpeg', blob: blob, name: src }, 'image/jpeg'); self.endPick(); }, 'image/jpeg'); };
    }, cancelPick: function wallpaper_cancelPick() { this.pickActivity.postError('cancelled'); this.endPick(); }, endPick: function wallpaper_endPick() { this.pickActivity = null; window.removeEventListener("keydown", this.changFocus); },
}; window.addEventListener('load', function pick() { window.removeEventListener('load', pick); Wallpaper.init(); });