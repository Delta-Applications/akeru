/**
 * @file - Match contact info by logs number
 *
 */

if (!window.document) {
  importScripts(
    'http://shared.localhost/js/session/contacts_manager/contacts_manager.js'
  );
}

// Formatter num
const formatterNumber = number => {
  const join = ['s', '-', '.', '(', ')'].join('|\\');
  const regexp = new RegExp('(\\' + join + ')', 'g');
  return number.replace(regexp, '');
};

// Match better num
const getBestMatch = (number, contacts) => {
  if (contacts.length === 0) {
    return null;
  }

  let bestMatchLength = 0;
  let bestMatch = null;
  const formattedSearchNumber = formatterNumber(number);

  contacts.forEach(contact => {
    contact.tel.forEach(tel => {
      const matchResultNumber = tel.value;
      const formattedMatchResultNumber = formatterNumber(matchResultNumber);

      if (
        formattedSearchNumber.indexOf(formattedMatchResultNumber) !== -1
        || formattedMatchResultNumber.indexOf(formattedSearchNumber) !== -1
      ) {
        const numberLength = formattedMatchResultNumber.length;
        if (numberLength > bestMatchLength) {
          bestMatchLength = numberLength;

          const { id, name, photoBlob, photoType, email = [] } = contact;
          const emailName = email.length > 0 ? email[0].value : '';

          bestMatch = {
            id: id,
            name: name || emailName || matchResultNumber,
            number: number,
            type: tel.atype,
            photoBlob: photoBlob && photoBlob.byteLength > 0
              ? btoa(String.fromCharCode(...photoBlob))
              : null,
            photoType: photoType
          };
        }
      }
    });
  });

  return bestMatch;
};

// search info with num
const findContact = async number => {
  console.log('Search Number:', number);
  const formattedNumber = formatterNumber(number);

  const options = {
    filterBy: [ContactsManager.FilterByOption.TEL],
    filterOption: ContactsManager.FilterOption.MATCH,
    filterValue: formattedNumber,
    onlyMainData: true
  };

  const cursor = await ContactsManager.find(options, 5);
  let contacts = [];
  try {
    let contactsCursor = await cursor.next();
    while (contactsCursor.length) {
      contacts = contacts.concat(contactsCursor);
      contactsCursor = await cursor.next();
    }
  } catch (err) {
    console.log(err);
  }

  cursor.release();

  return getBestMatch(number, contacts);
};

const MatchContact = numberArr => {
  const contactsMap = new Map();
  const promiseArr = [];
  numberArr.forEach(num => {
    promiseArr.push(findContact.call(null, num));
  });

  return new Promise((resolve, reject) => {
    Promise.all(promiseArr)
      .then(matchResultArr => {
        matchResultArr.forEach(item => {
          if (item) {
            contactsMap.set(item.number, item);
          }

          resolve(contactsMap);
        });
      })
      .catch(error => {
        console.log(error);
        reject(contactsMap);
      });
  });
};
