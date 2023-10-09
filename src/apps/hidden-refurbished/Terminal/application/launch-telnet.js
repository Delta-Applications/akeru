/* Terminal application for KaiOS
 * file: launch-telnet.js
 * Copyright (C) 2020 Affe Null
 * See LICENSE.txt for more details.
 */

/* Start the telnet server */

!function(){
	var ext = navigator.engmodeExtension || navigator.kaiosExtension;
	ext.startUniversalCommand("COLUMNS=20 LINES=13 busybox telnetd -b 127.0.0.1 -l /system/bin/sh", true).onsuccess = main;
	/* Starts main part of the app only when the telnet server has started
	 */
}();
