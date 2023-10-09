/* Terminal application for KaiOS
 * file: app.js
 * Copyright (C) 2020 Affe Null
 * See LICENSE.txt for more details.
 */

/* Called by launch-telnet.js */
function main(){
	if(!localStorage.fgColor) localStorage.fgColor = "white";
	if(!localStorage.bgColor) localStorage.bgColor = "black";
	var elTerm = document.getElementById("text");
	elTerm.style.backgroundColor = localStorage.bgColor;
	var chars = [];
	var curx = 0, cury = 0;
	var numindex, num, esc = false; esc_bracket = false,
		esc_paren_open = false, esc_question = false,
		lineDrawing = false, cursorKeys = false;
	var textattrs = {
		"bold": false,
		"inverse": false,
		"color": localStorage.fgColor,
		"backgroundColor": localStorage.bgColor
	}
	var ignoreChars = 0;
	const maxx = 30;
	const maxy = 20;
	var keys = [
		[' ', '0'],
		['.', ',', '?', '!', '1', ';', ':', '/', '@', '-', '+', '_',
			'=', '$', '|', '<', '>'],
		['a', 'b', 'c', '2'],
		['d', 'e', 'f', '3'],
		['g', 'h', 'i', '4'],
		['j', 'k', 'l', '5'],
		['m', 'n', 'o', '6'],
		['p', 'q', 'r', 's', '7'],
		['t', 'u', 'v', '8'],
		['w', 'x', 'y', 'z', '9']
	]
	var currentKey = -1;
	var currentKeyIndex = 0;
	var sendTimeoutId = 0;
	var control = false, uc = false;
	function process_attrs(code){
		if(code == 1){
			textattrs.bold = true;
		}
		else if(code == 7){
			textattrs.inverse = true;
		}
		else if(code == 21){
			textattrs.bold = false;
		}
		else if(code == 27){
			textattrs.inverse = false;
		}
		else if(!code){
			textattrs.bold = false;
			textattrs.inverse = false;
			textattrs.color = localStorage.fgColor;
			textattrs.backgroundColor = localStorage.bgColor;
		}
		else {
			const map_code_to_color = {
				30: "black",
				31: "#900",
				32: "#090",
				33: "#f90",
				34: "#009",
				35: "#909",
				36: "#099",
				37: "#999",
				90: "#444",
				91: "#f44",
				92: "#4f4",
				93: "#ff4",
				94: "#44f",
				95: "#f4f",
				96: "#4ff",
				97: "white"
			};
			if((code >= 40 && code < 48) ||
				(code >= 100 && code < 108))
			{
				textattrs.backgroundColor = map_code_to_color[
					code - 10
				];
			}
			else if((code >= 30 && code < 38) ||
				(code >= 90 && code < 98))
			{
				textattrs.color = map_code_to_color[code];
			}
			else if(code == 39){
				textattrs.color = localStorage.fgColor;
			}
			else if(code == 49){
				textattrs.backgroundColor = localStorage.bgColor;
			}
		}
	}
	function recolorTerminal(){
		textattrs.color = localStorage.fgColor;
		textattrs.backgroundColor = localStorage.bgColor;
		for(var i = 0; i < maxy; i++){
			for(var j = 0; j < maxx; j++){
				chars[i][j].style.color = localStorage.fgColor;
				chars[i][j].style.backgroundColor =
					localStorage.bgColor;
			}
		}
		elTerm.style.backgroundColor = localStorage.bgColor;
	}
	function setChar(x, y, ch){
		if(textattrs.bold) chars[y][x].style.fontWeight =
			"bold";
		else chars[y][x].style.fontWeight =
			"normal";
		if(textattrs.inverse){
			chars[y][x].style.color =
				textattrs.backgroundColor;
			chars[y][x].style.backgroundColor =
				textattrs.color;
		}
		else {
			chars[y][x].style.color =
				textattrs.color;
			chars[y][x].style.backgroundColor =
				textattrs.backgroundColor;
		}
		chars[y][x].textContent = lineDrawing ?
			(specialCharacters.hasOwnProperty(ch) ?
				specialCharacters[ch] : ch) : ch;
	}
	function ctrl(ch){
		return String.fromCharCode(ch.toUpperCase().charCodeAt(0) - 0x40);
	}
	function putChar(ch, noCursorUpdate){
		if(ch == "\x1b"){
			esc = true;
			return;
		}
		else if(esc){
			if(ch == "["){
				esc_bracket = true;
				num = Array();
				numindex = 0;
			}
			else if(ch == "("){
				esc_paren_open = true;
			}
			esc = false;
		}
		else if(esc_paren_open){
			esc_paren_open = false;
			if(ch == "0") lineDrawing = true;
			else if(ch == "B") lineDrawing = false;
		}
		else if(esc_question){
			if(isNaN(ch)){
				esc_question = false;
				if(num[0] == 1){
					cursorKeys = (ch == "h");
				}
			}
			else {
				if(num[0]){
					num[0] *= 10;
					num[0] += Number(ch);
				}
				else {
					num[0] = Number(ch);
				}
			}
		}
		else if(esc_bracket){
			esc_bracket = false;
			if(!isNaN(ch)){
				if(num[numindex]){
					num[numindex] *= 10;
					num[numindex] += Number(ch);
				}
				else {
					num[numindex] = Number(ch);
				}
				esc_bracket = true;
			}
			else if(ch == ";"){
				numindex++;
				esc_bracket = true;
			}
			else {
				var val = num[0] ? num[0] : 1;
				switch(ch){
				case "?":
					esc_question = true;
					break;
				case "B":
					if(cury + val < maxy) cury += val;
					break;
				case "A":
					if(cury - val >= 0) cury -= val;
					break;
				case "C":
					if(curx + val < maxx) curx += val;
					break;
				case "D":
					if(curx - val >= 0) curx -= val;
					break;
				case "d":
					cury = num[0] ? num[0]-1 : 0;
					if(cury >= maxy) cury = maxy-1;
					break;
				case "@":
					for(var i = 0; i < val; i++){
						for(var j = maxx-2;
							j >= curx; j--)
						{
							chars[cury][j+1].
								innerHTML =
							chars[cury][j].
								innerHTML;
							chars[cury][j+1].
								style.color =
							chars[cury][j].
								style.color;
							chars[cury][j+1].style.
								backgroundColor=
							chars[cury][j].style.
								backgroundColor;
							chars[cury][j+1].style.
								fontWeight =
							chars[cury][j].style.
								fontWeight;
						}
						setChar(curx, cury, " ");
					}
					break;
				case "P":
					for(var i = 0; i < val; i++){
						for(var j = curx;
							j < maxx-1; j++)
						{
							chars[cury][j].
								innerHTML =
							chars[cury][j+1].
								innerHTML;
							chars[cury][j].
								style.color =
							chars[cury][j+1].
								style.color;
							chars[cury][j].style.
								backgroundColor=
							chars[cury][j+1].style.
								backgroundColor;
							chars[cury][j].style.
								fontWeight =
							chars[cury][j+1].style.
								fontWeight;
						}
						setChar(maxx-1, cury, " ");
					}
					break;
				case "L":
					newLineAt(cury);
					break;
				case "M":
					removeLineAt(cury);
					break;
				case "H":
				case "f":
					cury = num[0] ? num[0]-1 : 0;
					curx = num[1] ? num[1]-1 : 0;
					if(cury >= maxy) cury = maxy-1;
					if(curx >= maxx) curx = maxy-1;
					break;
				case "J":
					var i = cury, end = chars.length;
					var j = curx, line_end = maxx;
					if(num[0]){
						i = 0;
						j = 0;
					}
					if(num[0] == 1){
						end = cury;
						line_end = curx-1;
					}
					for(; i < end; i++){
						for(; j < line_end; j++){
							setChar(j, i, " ");
						}
						j = 0;
						line_end = maxx;
					}
					break;
				case "K":
					var i = curx, end = maxx;
					if(num[0]) i = 0;
					if(num[0] == 1) end = curx;
					for(; i < end; i++){
						setChar(i, cury, " ");
					}
					break;
				case "m":
					for(var i = 0; i < num.length; i++)
						process_attrs(
							num[i]
						);
					if(num.length == 0)
						process_attrs(
							0
						);
					break;
				}
			}
		}
		else if(ch == "\n"){
			cury++;
			if(cury == maxy){
				newLine();
				cury--;
			}
		}
		else if(ch == "\r") curx = 0;
		else if(ch == "\b" && curx != 0){
			curx--;
			chars[cury][curx].textContent = " ";
		}
		else if(ch.charCodeAt(0) < 0x20) return;
		else {
			if(curx == maxx){
				cury++;
				curx = 0;
				if(cury == maxy){
					newLine();
					cury--;
				}
			}
			/*console.log("Character " + ch + " at (" + curx + "," +
				cury + ")");*/
			setChar(curx, cury, ch);
			curx++;
		}
	}
	function newLineAt(line){
		if(!chars[line+1]){
			return;
		}
		var elCurrentLine = chars[line][0].parentElement;
		chars = chars.slice(0, line).concat([[]]).
			concat(chars.slice(line));
		chars.pop();
		console.log(chars);
		var elNewLine = document.createElement("span");
		for(var j = 0; j < maxx; j++){
			var newch = 
				document.createElement("span");
			newch.textContent = "";
			chars[line].push(newch);
			elNewLine.appendChild(newch);
		}
		elTerm.insertBefore(elNewLine, elCurrentLine);
		elTerm.insertBefore(document.createElement("br"),
			elCurrentLine);
		var oldcurx = curx, oldcury = cury;
		cury = line;
		curx = 0;
		putStr("                    ");
		curx = oldcurx;
		cury = oldcury;
		elTerm.removeChild(elTerm.lastChild);
		elTerm.removeChild(elTerm.lastChild);
	}
	function removeLineAt(line){
		var elCurrentLine = chars[line][0].parentElement;
		chars = chars.slice(0, line).
			concat(chars.slice(line+1, maxy));
		chars.push([]);
		var elNewLine = document.createElement("span");
		for(var j = 0; j < maxx; j++){
			var newch = 
				document.createElement("span");
			newch.textContent = "";
			chars[chars.length-1].push(newch);
			elNewLine.appendChild(newch);
		}
		elTerm.appendChild(elNewLine);
		elTerm.appendChild(document.createElement("br"));
		var oldcurx = curx, oldcury = cury;
		cury = maxy-1;
		curx = 0;
		putStr("                    ");
		curx = oldcurx;
		cury = oldcury;
		elTerm.removeChild(elCurrentLine.nextSibling);
		elTerm.removeChild(elCurrentLine);
	}
	/* Append a new line to the terminal and rotate if necessary. */
	function newLine(){
		chars.push([]);
		if(cury == maxy){
			chars.shift();
		}
		var elNewLine = document.createElement("span");
		for(var j = 0; j < maxx; j++){
			var newch = 
				document.createElement("span");
			newch.textContent = "";
			chars[chars.length-1].push(newch);
			elNewLine.appendChild(newch);
		}
		var oldcurx = curx, oldcury = cury;
		cury = chars.length-1;
		curx = 0;
		putStr("                    ");
		curx = oldcurx;
		cury = oldcury;
		if(cury == maxy){
			elTerm.removeChild(elTerm.firstChild);
			elTerm.removeChild(elTerm.firstChild);
		}
		elTerm.appendChild(elNewLine);
		elTerm.appendChild(document.createElement("br"));
	}
	function putStr(str){
		for(var i = 0; i < str.length; i++) putChar(str[i]);
	}
	window.putStr = putStr;
	/* Initialize terminal */
	for(var i = 0; i < maxy; i++) newLine();

	/* Connect to telnet server */
	var sock = navigator.mozTCPSocket.open('localhost', 23);
	sock.onerror = function(){
		alert("connection error");
		window.onkeydown = null;
		window.close();
	}
	sock.onclose = function(){
		alert("connection closed");
		window.onkeydown = null;
		window.close();
	}
	sock.ondata = function(e){
		var data = e.data
		var oldDataLength = data.length;
		var escIndex;
		data = data.substr(ignoreChars);
		ignoreChars = (oldDataLength < ignoreChars) ?
			oldDataLength - ignoreChars : 0;
		if(data.length == 0) return;
		/* Ignore telnet control characters */
		while((escIndex = data.indexOf(String.fromCharCode(255))) >= 0){
			putStr(data.substr(0, escIndex));
			if(data.length - escIndex < 2){
				ignoreChars = 2 - data.length;
				return;
			}
			data = data.substr(3);
		}
		putStr(data);
	}
	sock.onopen = function(){
		console.log("connection started");
		function telnetSend(ch){
			sock.send(ch);
		}
		/* Connection started, now you can send data */
		window.onkeydown = function(e){
			function send(){
				if(control){
					control = false;
					telnetSend(
						ctrl(
							keys[currentKey]
							[currentKeyIndex]
						)
					);
				}
				else {
					telnetSend(
						uc ? keys[currentKey]
						[currentKeyIndex].toUpperCase()
						: keys[currentKey]
						[currentKeyIndex]
					);
				}
				currentKeyIndex = 0;
				currentKey = -1;
			}
			if(e.keyCode >= 48 && e.keyCode < 58){
				/* number */
				var num = e.keyCode - 48;
				if(currentKey == num) currentKeyIndex =
					(currentKeyIndex + 1) %
					keys[num].length;
				else {
					if(currentKey >= 0) send();
					currentKey = num;
					currentKeyIndex = 0;
				}
				sendTimeoutId && clearTimeout(sendTimeoutId);
				sendTimeoutId = setTimeout(send, 1000);
			}
			if(e.key == "Backspace"){
				e.preventDefault();
				if(currentKey >= 0){
					/* User was typing something,
					 * clear it */
					clearTimeout(sendTimeoutId);
					currentKeyIndex = 0;
					currentKey = -1;
				}
				else telnetSend("\b");
			}
			if(e.key == "Enter"){
				if(currentKey >= 0) send();
				telnetSend("\n");
			}
			if(e.key == "Call"){
				/* Toggle control */
				if(currentKey >= 0) send();
				control = !control;
			}
			if(e.key == "SoftLeft"){
				/* Tab */
				if(currentKey >= 0) send();
				telnetSend("\t");
			}
			if(e.key == "#"){
				/* Toggle uppercase */
				if(currentKey >= 0) send();
				uc = !uc;
			}
			if(e.key == "*"){
				/* Options */
				if(currentKey >= 0) send();
				showOptions(telnetSend, recolorTerminal);
			}
			if(/Arrow.*/.test(e.key)){
				if(currentKey >= 0) send();
				var k = cursorKeys ? "0" : "[";
				switch(e.key){
					case "ArrowUp":
						telnetSend("\x1b" + k + "A");
						break;
					case "ArrowDown":
						telnetSend("\x1b" + k + "B");
						break;
					case "ArrowLeft":
						telnetSend("\x1b" + k + "D");
						break;
					case "ArrowRight":
						telnetSend("\x1b" + k + "C");
						break;
				}
			}

		};
	};
}
