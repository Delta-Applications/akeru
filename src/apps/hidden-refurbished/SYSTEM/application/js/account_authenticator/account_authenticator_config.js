const AccountAuthenticatorConfig = {
  permittedOrigins: [
    'app://system.gaiamobile.org',
    'app://settings.gaiamobile.org',
    'app://contact.gaiamobile.org',
    'app://calendar.gaiamobile.org',
    'app://email.gaiamobile.org',
  ],
  authenticators: [
    { authenticatorId: 'google', refreshable: true },
    { authenticatorId: 'activesync', refreshable: false },
  ],
}

window.AccountAuthenticatorConfig = AccountAuthenticatorConfig