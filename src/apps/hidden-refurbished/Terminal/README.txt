This is a terminal emulator app for KaiOS devices with busybox. This is a beta
version, it does not support all escape sequences and controlcharacters.
It currently supports:
  - Clearing the screen
  - Moving the cursor
  - Bold text
  - Text color
  - Normal and line-drawing fonts
The app starts a busybox telnet server listening on 127.0.0.1 (localhost) and
connects to it using the mozTCPSocket API.
Keys:
	Call = control
	'#' = toggle uppercase/lowercase
	0-9 = input text
	LSK = tab
	Enter
	Arrow keys

The terminal applications know the size of the terminal, because it is specified in the environment of the telnet server.
Working terminal applications:
  - sh
  - busybox sh
  - bash (from debian)
  - more
  - less
Prograns that work but look buggy:
  - busybox vi
  - vim
  - nano
