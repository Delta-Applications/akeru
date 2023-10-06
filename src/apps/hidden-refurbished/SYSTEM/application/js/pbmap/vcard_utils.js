/* global mozContact*/
'use strict';
(function(exports) {

  let vCardProperties = {
    0: 'version', 1: 'fn',
    2: 'n', 3: 'photo',
    4: 'bday', 5: 'adr',
    6: 'label', 7: 'tel',
    8: 'email', 9: 'mailer',
    10: 'tz', 11: 'geo',
    12: 'title', 13: 'role',
    14: 'logo', 15: 'agent',
    16: 'org', 17: 'note',
    18: 'rev', 19: 'sound',
    20: 'url', 21: 'uid',
    22: 'key', 23: 'nickname',
    24: 'categories', 25: 'proid',
    26: 'class', 27: 'sort-string',
    28: 'x-irmc-call-datetime', 29: 'x-bt-speeddialkey',
    30: 'x-bt-uci', 31: 'x-bt-uid'
  };

  function filterByCardSelector(vcardSel, vcardOp, contacts) {
    let newContacts = [];
    let vcardArray = [];
    let contactMember;
    let result;

    // If vcardSel is empty,we will not modify the ContactManager object
    if (!vcardSel.length) {
      return contacts;
    }

    for (let i in vcardSel) {
      vcardArray.push(vCardProperties[vcardSel[i]]);
    }
    for (let j in contacts) {
      contactMember = contacts[j];
      if (vcardOp === 'OR') {
        result = false;
        for (let m in vcardArray) {
          result = result || findProperty(vcardArray[m], contactMember);
        }
      }
      else if (vcardOp === 'AND') {
        result = true;
        for (let n in vcardArray) {
          result = result && findProperty(vcardArray[n], contactMember);
        }
      }

      if (result) {
        newContacts.push(contactMember);
      }
    }
    return newContacts;
  }

  function filterByPropSelector(vcardVersion, propSel, contacts) {
    let proparray = [];

    // If propSel is empty,we will not modify the ContactManager object
    if (!propSel.length) {
      return;
    }

    // Transfer the enum type of propSel into string
    if (vcardVersion === 'vCard21') {
      // Mandatory properties for vCard 2.1 are VERSION ,N and TEL.
      proparray.push('version', 'n', 'tel');
    } else {
      // Mandatory properties for vCard 3.0 are VERSION, N, FN and TEL.
      proparray.push('version', 'fn', 'n', 'tel');
    }

    propSel.forEach(item =>{
      if (proparray.indexOf(item) === -1) {
        proparray.push(item);
      }
    });

    for (let j = 0; j < 32; j++) {
      if (proparray.indexOf(vCardProperties[j]) === -1) {
        removeProperty(vCardProperties[j], contacts);
      }
    }
  }

  function removeProperty(vCardProperty, contacts) {
    let contactMember;

    for (let index in contacts) {
      contactMember = contacts[index];
      switch (vCardProperty) {
        case 'version':
          break;
        case 'fn':
          contactMember.givenName = null;
          break;
        case 'n':
          contactMember.name = null;
          break;
        case 'photo':
          contactMember.photo = null;
          break;
        case 'bday':
          contactMember.bday = null;
          break;
        case 'adr':
          contactMember.adr = null;
          break;
        case 'tel':
          contactMember.tel = null;
          break;
        case 'email':
          contactMember.email = null;
          break;
        case 'org':
          contactMember.org = null;
          break;
        case 'note':
          contactMember.note = null;
          break;
        case 'url':
          contactMember.url = null;
          break;
        case 'key':
          contactMember.key = null;
          break;
        case 'nickname':
          contactMember.nickname = null;
          break;
        case 'categories':
          contactMember.category = null;
          break;
        case 'x-irmc-call-datetime':
          contactMember.xirmc = null;
          break;

        // TBD
        case 'lable':
        case 'mailer':
        case 'tz':
        case 'geo':
        case 'title':
        case 'role':
        case 'logo':
        case 'agent':
        case 'rev':
        case 'sound':
        case 'uid':
        case 'proid':
        case 'class':
        case 'sort-string':
        case 'x-bt-speeddialkey':
        case 'x-bt-uci':
        case 'x-bt-uid':
          break;
      }
    }
  }

  function findProperty(vCardProperty, contactMember) {
    switch (vCardProperty) {
      case 'fn':
        return contactMember.givenName == null ?
          false : contactMember.givenName.length !== 0;
      case 'n':
        return contactMember.name == null ?
          false : contactMember.name.length !== 0;
      case 'photo':
        return contactMember.photo == null ?
          false : contactMember.photo.length !== 0;
      case 'bday':
        return contactMember.bday == null ?
          false : contactMember.bday.length !== 0;
      case 'adr':
        return contactMember.adr == null ?
          false : contactMember.adr.length !== 0;
      case 'tel':
        return contactMember.tel == null ?
          false : contactMember.tel.length !== 0;
      case 'email':
        return contactMember.email == null ?
          false : contactMember.email.length !== 0;
      case 'org':
        return contactMember.org == null ?
          false : contactMember.org.length !== 0;
      case 'note':
        return contactMember.note == null ?
          false : contactMember.note.length !== 0;
      case 'url':
        return contactMember.url == null ?
          false : contactMember.url.length !== 0;
      case 'key':
        return contactMember.key == null ?
          false : contactMember.key.length !== 0;
      case 'nickname':
        return contactMember.nickname == null ?
          false : contactMember.nickname.length !== 0;
      case 'categories':
        return contactMember.category == null ?
          false : contactMember.category.length !== 0;
      default:
        return false;
    }
  }

  function genCallLogObj(callArray, version) {
    let convertResult = [];
    let missedCall = 'MISSED';
    let receivedCall = 'RECEIVED';
    let dialedCall = 'DIALED';
    let v3Header = 'TYPE=';
    let irmcHeader;

    if (version === 'vCard30') {
      missedCall = v3Header + missedCall;
      receivedCall = v3Header + receivedCall;
      dialedCall = v3Header + dialedCall;
    }

    callArray.forEach(function(element) {
      let newContact = new mozContact();

      newContact.name = [element.name];
      newContact.familyName = [element.fn];

      if (element.type === 'ic') {
        irmcHeader = receivedCall;
      } else if (element.type === 'oc') {
        irmcHeader = dialedCall;
      } else if (element.type === 'mc') {
        irmcHeader = missedCall;
      }
      newContact.xirmc = irmcHeader + ':' + element.time;
      newContact.tel = [{type: ['home'], value: element.tel}];
      convertResult.push(newContact);
    });

    return convertResult;
  }

  exports.filterByCardSelector = filterByCardSelector;
  exports.filterByPropSelector = filterByPropSelector;
  exports.genCallLogObj = genCallLogObj;
}(window));
