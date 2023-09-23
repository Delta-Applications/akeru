DebugHelper.log(`clock Attention window: onring.js init`);
const servicesArray = [
  'settingsService'
];
window.libSession.initService(servicesArray).then(() => {
  SettingsObserver.init();
  DebugHelper.init();
  DebugHelper.log(`clock Attention window: SettingsObserver init`);
  window.receiveMsg = true;
  var scriptNode = document.createElement('script');
  scriptNode.setAttribute('data-main', 'js/startup.js');
  scriptNode.src = 'js/alameda.js';
  document.head.appendChild(scriptNode);
  LazyLoader.load([
    'http://shared.localhost/js/helper/date_time/date_time_helper.js',
    'http://shared.localhost/js/utils/components/component_utils.js',
    'js/settings_app.js'
  ]);
});

navigator.serviceWorker.addEventListener('message',(message) => {
  window.message = message.data.path;
  if (message.data.type === 'alarm') {
    window.dispatchEvent(new CustomEvent('clock-receive-message'));
  }
});
