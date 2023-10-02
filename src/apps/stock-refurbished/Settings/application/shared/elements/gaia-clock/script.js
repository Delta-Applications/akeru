/* global ComponentUtils */

(function(window) {
  var gaiaclock = Object.create(HTMLElement.prototype);
  var BASE_URL = '/shared/elements/gaia-clock/';
  var template = document.createElement('template');
  var clockHtml = `<div id="clock_time">
                     </div>
                     <div id="clock_date">
                     </div>
                     <hr id="line">` ;
  var _updateClockDate = function(){
    var date = new Date();
    var longDateFormat = navigator.mozL10n.get('longDateFormat');
    longDateFormat = longDateFormat.replace(', %Y', '');
    longDateFormat = '<span>'+longDateFormat+'</span>';
    var updateTime = (24 - date.getHours()) * 60 * 60 * 1000 -date.getMinutes() * 60 * 1000 - date.getMilliseconds();
    this.clockDate.innerHTML = new navigator.mozL10n.DateTimeFormat().localeFormat(date, longDateFormat);
    setTimeout(_updateClockDate.bind(this), updateTime);
    window.dispatchEvent(new CustomEvent('clock-face-update-view'));
  };
  var _updateClockTime = function(){
      var self = this ;
      navigator.mozL10n.ready(function() {
        var now = new Date();
        var shortTimeFormat = window.navigator.mozHour12 ?
        navigator.mozL10n.get('shortTimeFormat12') :
        navigator.mozL10n.get('shortTimeFormat24') ;
        shortTimeFormat = window.navigator.mozHour12 ?
        shortTimeFormat.replace("%I:%M","<span>%I:%M</span>") :
        shortTimeFormat.replace("%H:%M","<span>%H:%M</span>");
        shortTimeFormat = shortTimeFormat.replace('%p','<small>%p</small>');
        var nowTime = new navigator.mozL10n.DateTimeFormat().localeFormat(now, shortTimeFormat);
        self.clockTime.innerHTML = nowTime;
        setTimeout(_updateClockTime.bind(self), (60 - now.getSeconds()) * 1000);
        window.dispatchEvent(new CustomEvent('clock-face-update-view'));
     });
  };
  var _updateView = function(){
        var separator = true;
        if(document.domain!="verticalhome.gaiamobile.org") {
          this.clockPanel.style.display = '';
          separator = false;
        } else {
        if(!this.visible) {
           this.clockPanel.style.display = 'none';
         } else {
           this.clockPanel.style.display = '';
         }
        }
        var root = this.createShadowRoot();
        template.innerHTML = clockHtml;
        root.appendChild(template.content.cloneNode(true));
        this.clockTime = root.getElementById('clock_time');
        this.clockDate = root.getElementById('clock_date');
        this.line = root.getElementById('line');
       if(this.mode==='bold-digital'){
         this.clockTime.classList.add('bold_clock');
         this.clockDate.classList.add('bold_clock');
       }
       if(this.visibleDate) {
         this.clockDate.style.display = '';
       } else {
         this.clockDate.style.display = 'none';
       }
       if(separator) {
          this.line.style.display = '';
       } else {
          this.line.style.display = 'none';
       }
        _updateClockTime.call(this);
        _updateClockDate.call(this);
        ComponentUtils.style.call(this, BASE_URL);
  }
  gaiaclock.createdCallback = function(){
      window.addEventListener('clockchange', function(e){
      this.mode = e.detail.clockType;
      this.visibleDate = e.detail.isDisplayDate;
      this.visible = e.detail.visible;
      this.clockPanel = e.detail.clockPanel;

      _updateView.call(this);
    }.bind(this));
    window.addEventListener('clockpanelvisiblechange', function(e){
      var clockPanel = e.detail.clockPanel;
      if(clockPanel.style.display === 'none') {
          clockPanel.style.display = '';
      } else {
          clockPanel.style.display = 'none';
      }
    }.bind(this));
  };

  return document.registerElement('gaia-clock', { prototype: gaiaclock });

})(window);
