'use strict';
(function(exports) {

  const bMsgObjHeader = 'BEGIN:BMSG\r\n';
  const bMsgObjTailer = 'END:BMSG\r\n';
  const bInBoxFolder = 'TELECOM/MSG/INBOX\r\n';
  const bOutBoxFolder = 'TELECOM/MSG/OUTBOX\r\n';
  const vCardHeader = 'BEGIN:VCARD\r\n';
  const vCardTailer = 'END:VCARD\r\n';

  const MAP_LISTING_HEAD = '<MAP-msg-listing version = "1.0">\n';
  const MAP_LISTING_FOOT = '</MAP-msg-listing>\n';

  const MAP_REPORT_HEAD = '<MAP-event-report version = "1.0">\n';
  const MAP_REPORT_FOOT = '</MAP-event-report>\n';
  const MAP_REPORT_TYPE = {
    newMessage: '"NewMessage"',
    deliverySuccess: '"DeliverySuccess"',
    sendingSuccess: '"SendingSuccess"',
    deliveryFailure: '"DeliveryFailure"',
    sendingFailure: '"SendingFailure"',
    memoryFull: '"MemoryFull"',
    memoryAvailable: '"MemoryAvailable"',
    messageDeleted: '"MessageDeleted"',
    messageShift: '"MessageShift"'
  };
  const MAP_REPORT_FOLDER = {
    inbox: '"TELECOM/MSG/INBOX"',
    outbox: '"TELECOM/MSG/OUTBOX"'
  };
  const MAP_REPORT_MSG_TYPE_GSM = '"SMS_GSM"';
  const MAP_REPORT_MSG_TYPE_CDMA = '"SMS_CDMA"';

  function convert2Template (msg) {
    return `<msg handle = "${msg.id}" subject = "${msg.subject}" ` +
           `datetime = "${msg.datetime}" ` +
           `sender_name = "${msg.sender_name}" ` +
           `sender_addressing = "${msg.sender_addressing}" ` +
           `recipient_name = "${msg.recipient_name}" ` +
           `recipient_addressing = "${msg.recipient_addressing}" ` +
           `type = "${msg.type}" ` +
           `size = "${msg.size}" ` +
           `text = "${msg.text}" ` +
           `attachment_size = "${msg.attachment_size}" ` +
           `priority = "${msg.priority}" ` +
           `read = "${msg.read}" ` +
           `sent = "${msg.sent}" ` +
           `protected = "${msg.protected}"/>\n`;
  }

  function reformatXMLMsg(messages) {
    let data = '';
    let unreadFlag = false;

    function generateDate(ts) {
      return new Date(ts).toISOString().replace(/[-:]/ig, '').split('.')[0];
    }

    function getOwnerInfo() {
      return {
        name: 'local',
        addressing: '000000123'
      };
    }

    let currentMsgType = currentNetworkType();
    messages.forEach((item) => {
      let msgRecord = item;
      let msgTemplate = {
        id: msgRecord.id,
        priority: 'no',
        datetime: generateDate(msgRecord.timestamp),
        text: 'yes',
        read: msgRecord.read ? 'yes' : 'no',
        protected: 'no'
      };

      if (msgRecord.type === 'sms') {
        msgTemplate.type = currentMsgType;
        msgTemplate.subject = msgRecord.body.substring(0);
        msgTemplate.size = msgRecord.body.length;
        msgTemplate.attachment_size = 0;
      } else if (msgRecord.type === 'mms') {
        msgTemplate.type = 'MMS';
        msgTemplate.subject = '',
        msgTemplate.size = 0;
        msgTemplate.attachment_size = 0;
      }

      let ownInfo = getOwnerInfo();

      switch(msgRecord.delivery) {
        case 'sent':
          msgTemplate.sender_name = ownInfo.name;
          msgTemplate.sender_addressing = ownInfo.addressing;
          msgTemplate.recipient_name = msgRecord.receiver;
          msgTemplate.recipient_addressing = msgRecord.receiver;
          msgTemplate.sent = 'yes';
          break;
        case 'received':
          msgTemplate.sender_name = msgRecord.sender;
          msgTemplate.sender_addressing = msgRecord.sender;
          msgTemplate.recipient_name = ownInfo.name;
          msgTemplate.recipient_addressing = ownInfo.addressing;
          msgTemplate.sent = 'no';
          break;
        case 'sending':
          msgTemplate.sender_name = ownInfo.name;
          msgTemplate.sender_addressing = ownInfo.addressing;
          msgTemplate.recipient_name = msgRecord.receiver;
          msgTemplate.recipient_addressing = msgRecord.receiver;
          msgTemplate.sent = 'no';
          break;
        case 'error':
          console.error('Error when deliverting.');
          return;
        default:
          console.error('Unknown delivery status.');
          return;
      }
      data += convert2Template(msgTemplate);
      if (!msgRecord.read) {
         unreadFlag = true;
      }
    });

    return {
      size: messages.length,
      unreadFlag: unreadFlag,
      xml: MAP_LISTING_HEAD + data + MAP_LISTING_FOOT
    };
  }

  function reformatBMessage(item) {
    let bVerProp = 'VERSION:1.0\r\n';
    let bTypeProp = 'TYPE:' + currentNetworkType() + '\r\n';
    let bStatusProp = (item.read === true) ?
      'STATUS:READ\r\n' : 'STATUS:UNREAD\r\n';
    let bFolderPropContent = (item.delivery === 'received') ?
      bInBoxFolder : bOutBoxFolder;
    let bFolderProp = 'FOLDER:' + bFolderPropContent;
    let bMsgProp = bVerProp + bStatusProp + bTypeProp + bFolderProp;

    let vCardVer = 'VERSION:2.1\r\n';
    let vCardTelContent = (item.delivery === 'received') ?
      (item.sender + '\r\n') : (item.receiver + '\r\n');

    // Treat phone number as name if the name isn't available
    let vCardNameContent = (!item.vCard) ?
      vCardTelContent : (item.vCard[0].name + '\r\n');
    let vCardName = 'N:' + vCardTelContent;
    let vCardTel = 'TEL:' + vCardTelContent;
    let vCard = vCardHeader + vCardVer + vCardName + vCardTel + vCardTailer;

    let bMsgBodyContent = 'BEGIN:MSG\r\n' + item.body + '\r\n' + 'END:MSG\r\n';
    let bMsgBodyProp = 'ENCODING:C-8BIT\r\n' + 'LENGTH:' +
      (item.body.length + '\r\n');
    let bMsgContent = 'BEGIN:BBODY\r\n' + bMsgBodyProp +
      bMsgBodyContent + 'END:BBODY\r\n';

    let bMsgEnv = 'BEGIN:BENV\r\n' + bMsgContent + 'END:BENV\r\n';
    let bMsgObj = bMsgObjHeader + bMsgProp + vCard + bMsgEnv + bMsgObjTailer;

    return bMsgObj;
  }

  function reformatEventObj(item) {
    let objHeader = '<event ';
    let objTail = '/>\n';
    let objType  = 'type = ' + MAP_REPORT_TYPE[item.type] + ' ';
    let objHandle = 'handle = ' + '"' + item.handle + '" ';
    let objFolder = 'folder = ' + MAP_REPORT_FOLDER[item.folder] + ' ';
    let objMsgType = 'msg_type = ' + currentNetworkType() + ' ';
    let eventObj = objHeader + objType + objHandle + objFolder +
      objMsgType + objTail;

    return MAP_REPORT_HEAD + eventObj + MAP_REPORT_FOOT;
  }

  function currentNetworkType() {
    let conns = window.navigator.mozMobileConnections;
    if (!conns || conns.length < 1) {
      return MAP_REPORT_MSG_TYPE_GSM;
    } else {
      let type = conns[0].voice.type;
      return isGSMFamily(type) ? MAP_REPORT_MSG_TYPE_GSM : MAP_REPORT_MSG_TYPE_CDMA;
    }
  }

  function isGSMFamily(type) {
    switch (type) {
      case 'is95a':
      case 'is95b':
      case '1xrtt':
      case 'evdo0':
      case 'evdoa':
      case 'evdob':
      case 'ehrpd':
        return false;
      default:
        return true;
    }
  }

  exports.reformatEventObj = reformatEventObj;
  exports.reformatXMLMsg = reformatXMLMsg;
  exports.reformatBMessage = reformatBMessage;
  exports._convert2Template = convert2Template;
}(window));
