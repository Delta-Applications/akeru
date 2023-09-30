'use strict'; class ViewManager {
    constructor() { 
        this.scrollElement = document.getElementById('alert-content'); 
        window.navigator.mozSetMessageHandler('activity', (request) => { this.activity = request; this.showActivity(request); }); 
        window.navigator.mozSetMessageHandler('notification', (message) => { this.onNotification(message); }); 
        window.addEventListener('close-activity', () => { if (this.activity) { this.activity.postError('close'); this.activity = null; setTimeout(() => { window.close(); }, 100); } }); 
        document.body.classList.toggle('large-text', navigator.largeTextEnabled); 
        this.showActivity("alert_inbox")
    }

    showActivity(request) { 
        const name = request.source.name; if (name === 'alert_inbox') 
        { let notice = new Notices(); notice.checkNotifications().then(() => { AlertBox.show(); }); } }

    onNotification(message) {
        if (!message.clicked) { setTimeout(() => { if (!this.messageShown) { window.close(); } }); return; }
        ViewUtils.dismissNotice(message.tag); this.messageShown = true; navigator.mozApps.getSelf().onsuccess = (e) => { e.target.result.launch(); AlertDetail.show(message.data, 'notice'); };
    }
}