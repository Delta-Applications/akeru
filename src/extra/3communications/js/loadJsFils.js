const filesList = [
  'http://shared.localhost/elements/gaia_tabs/gaia_tabs.js',
  'http://shared.localhost/js/session/lib_session.js',
  'http://shared.localhost/js/session/task_scheduler.js',
  'http://shared.localhost/js/session/settings/settings_observer.js',
  'http://shared.localhost/js/session/device_capability/device_capability.js',
  'js/indexDB.js',
  'js/matchContact.js',
  'http://shared.localhost/js/utils/l10n/l10n.js',
  'http://shared.localhost/js/utils/l10n/l10n_date.js',
  'http://shared.localhost/js/helper/common/performance_testing_helper.js',
  'http://shared.localhost/js/utils/toaster/toaster.js',
  'http://shared.localhost/js/session/contacts_manager/contacts_manager.js',
  'http://shared.localhost/js/helper/date_time/date_time_helper.js',
  'http://shared.localhost/js/session/time_service/time_service.js',
  'http://shared.localhost/js/helper/softkey/softkey_register.js',
  'dist/vendors~app.js',
  'dist/styles.js',
  'dist/app.js'
];

window.onload = () => {
  window.LazyLoader.load(filesList);
};
