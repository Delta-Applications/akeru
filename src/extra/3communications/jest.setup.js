const { DB } = require('./src/test/mockDB');

window.performance.mark = () => { };
window.performance.measure = () => { };
window.performance.clearMarks = () => { };
window.performance.clearMeasures = () => { };
window.navigator.b2g = {
  iccIds: []
};

window.sdnContacts = {
  get: () => []
};

window.registerSoftkeys = () => { }

window.navigator.serviceWorker = {
  controller: {
    postMessage: () => { }
  }
}

let defaultIndex = -1;
const contactInfo = [
  [
    {
      name: 'telNum',
      id: 1,
      tel: [{
        value: 119,
        atype: ''
      }],
      email: [],
      photoBlob: new ArrayBuffer(),
      photoType: 'jpeg'
    }
  ], [
    {
      name: 'telName',
      id: 2,
      tel: [{
        value: 911,
        atype: ''
      }],
      email: [],
      photoBlob: new ArrayBuffer(),
      photoType: 'jpeg'
    }
  ],
  []
];

global = Object.assign(global, {
  DB,
  MatchContact: () => Promise.resolve(new Map([[119, {
    id: '1',
    name: 'test',
    number: 119,
    type: '',
    photoBlob: new ArrayBuffer(),
    photoType: 'jpeg'
  }]])),
  LazyLoader: {
    load: () => { }
  },
  TimeService: {
    addEventListener: (evName, callback) => {
      window.addEventListener(evName, callback);
    },
    removeEventListener: (evName, callback) => {
      window.removeEventListener(evName, callback);
    }
  },
  ContactsManager: {
    findBlockedNumbers: (e) => Promise.resolve([e.filterValue || '119']),
    addBlockedNumber: () => Promise.resolve(''),
    getAll: () => Promise.resolve({
      next: () => {
        defaultIndex = defaultIndex + 1;
        return Promise.resolve(contactInfo[defaultIndex]);
      },
      release: () => { }
    }),
    FilterOption: {
      MATCH: 0
    },
    SortOption: {
      FAMILY_NAME: '',
    },
    Order: {
      FAMILY_NAME: ''
    },
    ChangeReason: {
      REMOVE: 1,
      CREATE: 2,
      UPDATE: 3
    },
    EventMap: {
      CONTACT_CHANGE: 'CONTACT_CHANGE'
    },
    addEventListener: (args, callback) => {
      // auto call call back
      window.addEventListener(args, (evt) => {
        callback(evt);
      });
    },
    removeEventListener: (args, callback) => {
      window.removeEventListener(args, callback);
    }
  },
  DeviceCapabilityManager: {
    get: () => Promise.resolve(false)
  },
  SettingsObserver: {
    observe: () => { }
  },
  api: {
    l10n: {
      get: str => str,
      once: Fun => { Fun() }
    },
    hour12: null
  },
  WebActivity: function () {
    this.start = () => Promise.resolve()
  },
  Toaster: {
    showToast: () => { }
  }
});
