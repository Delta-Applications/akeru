/* exported MobileInfo, MobileOperator */


var SimCardsName = {};
var MobileInfo = {
  brazil: {
    carriers: {
      '00': 'NEXTEL',
      '02': 'TIM', '03': 'TIM', '04': 'TIM',
      '05': 'CLARO', '06': 'VIVO', '07': 'CTBC', '08': 'TIM',
      '10': 'VIVO', '11': 'VIVO', '15': 'SERCOMTEL',
      '16': 'OI', '23': 'VIVO', '24': 'OI', '31': 'OI',
      '32': 'CTBC', '33': 'CTBC', '34': 'CTBC', '37': 'AEIOU'
    },
    regions: {
      '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP',
      '17': 'SP', '18': 'SP', '19': 'SP',
      '21': 'RJ', '22': 'RJ', '24': 'RJ',
      '27': 'ES', '28': 'ES',
      '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG',
      '38': 'MG',
      '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
      '47': 'SC', '48': 'SC', '49': 'SC',
      '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
      '61': 'DF',
      '62': 'GO',
      '63': 'TO',
      '64': 'GO',
      '65': 'MT', '66': 'MT',
      '67': 'MS',
      '68': 'AC',
      '69': 'RO',
      '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
      '79': 'SE',
      '81': 'PE',
      '82': 'AL',
      '83': 'PB',
      '84': 'RN',
      '85': 'CE',
      '86': 'PI',
      '87': 'PE',
      '88': 'CE',
      '89': 'PI',
      '91': 'PA',
      '92': 'AM',
      '93': 'PA', '94': 'PA',
      '95': 'RR',
      '96': 'AP',
      '97': 'AM',
      '98': 'MA', '99': 'MA'
    }
  }
};

var MobileOperator = {
  BRAZIL_MCC: '724',
  BRAZIL_CELLBROADCAST_CHANNEL: 50,

  userFacingInfo: function mo_userFacingInfo(mobileConnection) {
    let network = null;
    let cell = null;
    if (mobileConnection.voice && mobileConnection.voice.connected) {
      network = mobileConnection.voice.network;
      cell = mobileConnection.voice.cell;
    } else if (mobileConnection.data &&
      mobileConnection.data.state === 'registered') {
      network = mobileConnection.data.network;
      cell = mobileConnection.data.cell;
    }
    let iccid = mobileConnection.iccId;
    let iccObj = navigator.mozIccManager.getIccById(iccid);
    let iccInfo = iccObj ? iccObj.iccInfo : null;
    let operator = network ? (network.shortName || network.longName) : null;
    if (operator && iccInfo && iccInfo.isDisplaySpnRequired && iccInfo.spn) {
      if (iccInfo.isDisplayNetworkNameRequired && operator !== iccInfo.spn) {
        operator = operator + ' ' + iccInfo.spn;
      } else {
        operator = iccInfo.spn;
      }
    }

    let carrier, region;
    if (this.isBrazil(mobileConnection, cell, network)) {
      // We are in Brazil, It is legally required to show local info
      // about current registered GSM network in a legally specified way.
      let lac = cell.gsmLocationAreaCode % 100;
      let carriers = MobileInfo.brazil.carriers;
      let regions = MobileInfo.brazil.regions;

      carrier = network ? carriers[network.mnc] ||
                (this.BRAZIL_MCC + network.mnc) : null;
      region = (regions[lac] ? regions[lac] + ' ' + lac : '');
    }

    let imsRegHandler = mobileConnection.imsHandler;
    if (imsRegHandler) {
      let shown = imsRegHandler.capability === 'voice-over-wifi' ||
                  imsRegHandler.capability === 'video-over-wifi';
      if (shown && iccInfo && iccInfo.isDisplaySpnRequired && iccInfo.spn) {
        operator = iccInfo.spn;
      }
    }
    if (SimCardsName && SimCardsName[iccid]) {
      operator = SimCardsName[iccid];
    }
/*[BTS-250]Modify Language zh-CN operator display start*/
    if(network){
       var currentLanguage = navigator.language;
       dump(' MobileOperator currentLanguage = ' + currentLanguage);
       var mcc, mnc;
       mcc = network.mcc;
       mnc = network.mnc;
       if (operator && (currentLanguage == "zh-CN" || currentLanguage == "zh-TW" || currentLanguage == "zh-HK")){
             if (mcc == '460' && (mnc == '00' || mnc == '04' || mnc == '07' || mnc == '08')){
                  operator = "中国移动";
              }
              else if (mcc == '460' && (mnc == '01' || mnc == '09')){
                  operator = "中国联通";
              }
              else if (mcc == '460' && (mnc == '03' || mnc == '11')){
                    operator = "中国电信";
              }
       }
       dump(' MobileOperator operator = ' + operator);
    }
/*[BTS-250]Modify Language zh-CN operator display end*/
    return {
      'operator': operator,
      'carrier': carrier,
      'region': region
    };
  },

  isBrazil: function mo_isBrazil(mobileConnection, cell, network) {
    return network ?
      (network.mcc === this.BRAZIL_MCC && cell && cell.gsmLocationAreaCode) :
      null;
  }
};

var settings = window.navigator.mozSettings;
if (window.navigator.mozSettings) {
  settings.createLock().get('custom.simcards.name').then((value) => {
    SimCardsName = value['custom.simcards.name'];
  });
  settings.addObserver('custom.simcards.name', (event) => {
    SimCardsName = event.settingValue;
  });
}

