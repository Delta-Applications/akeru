
//   const SoftKeyStoreInstance = {
//     // name: 'SoftKeyStore',

//     currentKeys: {},
//     currentTheme: null,
//     registeredDOMMap: new Map(),

//     register: function(keys, dom, theme) {
//       var currentInstance = this.registeredDOMMap.get(dom);
//       var self = this;
//       if (!currentInstance) {
//         currentInstance = {
//           start: function() {
//             dom.addEventListener('focus', this, true);
//             this.theme = theme;
//             this.updateKeys(keys);
//           },
//           stop: function() {
//             dom.removeEventListener('focus', this, true);
//           },
//           handleEvent: function() {
//             this.check();
//           },
//           check: function() {
//             if (document.activeElement === dom || dom.contains(document.activeElement)) {   
//               var result = self.recount();
//               self.store(result, this.theme);
//             }
//           },
//           updateKeys: function(keys) {
//             this.keys = keys;
//             this.check();
//           }
//         };
//         this.registeredDOMMap.set(dom, currentInstance);
//         currentInstance.start();
//       } else {
//         currentInstance.updateKeys(keys);
//       }
//     },

//     generateKeysInfo: function(keys) {
//       var keysInfo = [];
//       for (var key in keys) {
//         var info = {};
//         switch(key) {
//           case 'left':
//             info.code = 'SoftLeft';
//             break;
//           case 'center':
//             info.code = 'Enter';
//             break;
//           case 'right':
//             info.code = 'SoftRight';
//             break;
//         }
//         info.options = {
//           'name': keys[key]
//         };
//         keysInfo.push(info);
//       }
//       return keysInfo;
//     },

//     registerSoftkeys: function(keys) {
//       var keysInfo = this.generateKeysInfo(keys);
      
//       if (!keysInfo.length) {
//         return;
//       }

//       // registerKeys via softkeyManager
//       if(navigator.softkeyManager) {
//         keysInfo.forEach((key) => {
//           if (key.options.name) {
//             let id = '';
//             if (typeof key.options.name === 'object') {
//               id = key.options.name.text || id;
//             } else {
//               id = key.options.name;
//             }
//             key.options.name = this.toL10n(id);
//           }
//         });
//         navigator.softkeyManager.registerKeys(keysInfo);
//       }
//     },

//     toL10n: function(id = '') {
//       if ('complete' !== navigator.mozL10n.readyState || !id) {
//         return id;
//       }
//       return navigator.mozL10n.get(id) || id;
//     },

//     store: function(keys, theme) {
//       this.currentKeys = keys;
//       this.currentTheme = theme;
//       this.registerSoftkeys(keys);
//       this.emit('change');
//     },

//     recount: function() {
//       var result = {};
//       var current = document.activeElement;
//       while (current !== document.body) {
//         var instance = this.registeredDOMMap.get(current);
//         if (instance) {
//           var keys = instance.keys;
//           for (var key in keys) {
//             if (!(key in result)) {
//               result[key] = keys[key];
//             }
//           }
//         }
//         current = current.parentNode;
//       }
//       return result;
//     },

//     unregister: function(dom) {
//       var instance = this.registeredDOMMap.get(dom);
//       if (!instance) {
//         return;
//       }
//       instance.stop();
//       this.registeredDOMMap.delete(dom);
//       this.store(this.recount());
//     }
//   };

//   export default SoftKeyStoreInstance;



// // var softKeyStoreInstance = new SoftKeyStore();
// // softKeyStoreInstance.start();

// // export default softKeyStoreInstance;


import BaseEmitter from './base-emitter';
class SoftKeyStore extends BaseEmitter {
  name = 'SoftKeyStore';
  start() {
    this.currentKeys = {};
    this.registeredDOMMap = new Map();
  }
  register(keysInfo, dom) {
    var currentInstance = this.registeredDOMMap.get(dom);
    var self = this;
    if (!currentInstance) {
      currentInstance = {
        start: function() {
          dom.addEventListener('focus', this, true);
          this.updateKeys(keysInfo);
        },
        stop: function() {
          dom.removeEventListener('focus', this, true);
        },
        handleEvent: function() {
          // this.check(keysInfo);
        },
        check: function(keysInfo) {
          if (document.activeElement === dom || dom.contains(document.activeElement)) {
            var result = self.recount(keysInfo);
            self.store(result);
          }
        },
        updateKeys: function(keysInfo) {
          this.keys = keysInfo;
          this.check(keysInfo);
        }
      };
      this.registeredDOMMap.set(dom, currentInstance);
      currentInstance.start();
    } else {
      currentInstance.updateKeys(keysInfo);
    }
  }

  generateKeysInfo(keys) {
    var keysInfo = [];
    for (var key in keys) {
      var info = {};
      switch(key) {
        case 'left':
          info.code = 'SoftLeft';
          break;
        case 'center':
          info.code = 'Enter';
          break;
        case 'right':
          info.code = 'SoftRight';
          break;
      }
      info.options = {
        'name': keys[key]
      };
      keysInfo.push(info);
    }
    return keysInfo;
  }

  registerSoftkeys(keys) {
    var keysInfo = this.generateKeysInfo(keys);
    
    if (!keysInfo.length) {
      return;
    }

    // registerKeys via softkeyManager
    if (window.registerSoftkeys) {
      window.registerSoftkeys(keysInfo);
    }
  }

  store(keys) {
    this.currentKeys = keys;
    this.registerSoftkeys(keys);
    this.emit('change', { details: keys});
  }

  recount(keys) {
    var result = {};
    // var current = document.activeElement;
    // while (current !== document.body) {
    //   var instance = this.registeredDOMMap.get(current);
    //   if (instance) {
    //     var keys = instance.keys;
        for (var key in keys) {
          if (!(key in result)) {
            result[key] = keys[key];
          }
        }
    //   }
    //   current = current.parentNode;
    // }
    return result;
  }

  unregister(dom) {
    var instance = this.registeredDOMMap.get(dom);
    if (!instance) {
      return;
    }
    instance.stop();
    this.registeredDOMMap.delete(dom);
    this.store(this.recount());
  }
};

var softKeyStoreInstance = new SoftKeyStore();
softKeyStoreInstance.start();

export default softKeyStoreInstance;
