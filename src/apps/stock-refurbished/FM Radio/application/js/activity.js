/* open activity fmradio */
/* global activityData, handleOpenActivity, getNearlyFrequency */
'use strict';
navigator.mozL10n.once(() => {
  navigator.mozSetMessageHandler('activity', handleOpenActivity);
});


let activityData = {};

function handleOpenActivity(request) {
  if (!request) {
    console.error('open activity must pass parameter');
    return;
  }
  activityData = request.source.data;
  const frequency = getNearlyFrequency(activityData.query);
  const currentFrequency = FrequencyDialer.getFrequency();
  if (!mozFMRadio.enabled) {
    FMRadio.enableFMRadio(frequency);
  } else if (frequency !== currentFrequency) {
    mozFMRadio.setFrequency(frequency);
  }
}

/*
* @desc through the pass frequency get the local nearly frequency.
* @param Frequency {Number/String}
* @return Frequency {Number}
* */
function getNearlyFrequency(query) {
  if (!query) {
    return;
  }
  const frequencyListArr = Object.values(FrequencyManager.frequencyList);

  // can not find station name, return list first, and if list not exist
  // return frequencyLowerBound
  if (typeof query === 'string') {
    let defaultFrequency = mozFMRadio.frequencyLowerBound;
    let queryName = query.toLowerCase();
    if (frequencyListArr.length > 0) {
      defaultFrequency = frequencyListArr[0].frequency;
    }
    if (queryName === 'all') {
      return Number(defaultFrequency);
    }
    frequencyListArr.forEach(value => {
      if (value.name.toLowerCase() === queryName) {
        defaultFrequency = value.frequency;
      }
    });
    return Number(defaultFrequency);
  }

  // return the nearest frequency in list. if list not exist, return itself.
  if (typeof query === 'number') {
    let resFrequency, originFrequency = Number(query);
    let isExist = false;
    if (frequencyListArr.length === 0) {
      return originFrequency;
    }
    let freStart = Number(frequencyListArr[0].frequency);
    let freEnd = Number(frequencyListArr[frequencyListArr.length - 1].frequency);
    for (let i = 0; i < frequencyListArr.length; i++) {
      let frequencyTemp = Number(frequencyListArr[i].frequency);
      if (frequencyTemp < originFrequency) {
        freStart = frequencyTemp;
      } else if (frequencyTemp === originFrequency) {
        isExist = true;
      } else {
        freEnd = frequencyTemp;
        break;
      }
    }
    // determine the nearest frequency
    (originFrequency - freStart).toFixed(1) >
    (freEnd - originFrequency).toFixed(1) ?
      resFrequency = freEnd : resFrequency = freStart;
    return isExist ? originFrequency : resFrequency;
  }

}
