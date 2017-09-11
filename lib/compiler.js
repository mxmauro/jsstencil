/*!
 * JsStencil - https://github.com/mxmauro/jsstencil
 *
 * Copyright(c) 2017 Mauro H. Leggieri <mxmauro [at] mauroleggieri [dot] com>
 * MIT Licensed
 */
'use strict';

//------------------------------------------------------------------------------

exports.compile = function(template, filename)
{
	const CodeModeNone = 0;
	const CodeModeInCode = 1;
	const CodeModeInCodePrint = 2;
	var ofs = 0, chQuote = 0, nonCodeBlockStart = 0, codeMode = CodeModeNone;
	var ret;

	//remove UTF-8 BOM if any
	template = template.replace(/^\uFEFF/, '');
	template = template.replace(/^\xEF\xBB\xBF/, '');

	//locate for '<%... %>' blocks outside of quotes
	while (ofs < template.length)
	{
		if (chQuote == 0)
		{
			var ch = template.charCodeAt(ofs);
			var ch1 = template.charCodeAt(ofs + 1);

			if (ch == 92 && (ch1 == 34 || ch1 == 39 || ch1 == 92)) {
				ofs += 2; //escaped quotes or double escape char
			}
			else if (codeMode != CodeModeNone && (ch == 34 || ch == 39)) {
				//only process strings inside JS template
				chQuote = ch;
				ofs++;
			}
			else if (codeMode != CodeModeNone && ch == 47 && ch1 != 47 && ch1 != 42) {
				//check for a possible regular expression
				var pos = ofs + 1;

				//parse expression
				while (pos < template.length) {
					ch = template.charAt(pos);
					ch1 = (pos + 1 < template.length) ? template.charAt(pos + 1) : 0;
					if ("/\t ),;".indexOf(ch) >= 0 || (ch == '%' && ch1 == '>'))
						break;
					if (ch == '\\' && ch1 != 0)
						pos++;
					pos++;
				}
				if (template.charCodeAt(pos) == 47) {
					//parse flags
					pos++;
					while (pos < template.length) {
						ch = template.charCodeAt(pos);
						if ((ch < 65 || ch > 90) && (ch < 97 || ch > 122))
							break;
						pos++;
					}
					if (pos < template.length) {
						ch = template.charAt(pos);
						ch1 = (pos + 1 < template.length) ? template.charAt(pos + 1) : 0;
						if ("/\t ),;".indexOf(ch) >= 0 || (ch == '%' && ch1 == '>')) {
							//got a RegEx expression, advance the pointer until here
							ofs = pos;
							continue;
						}
					}
				}
				//if we reach here, then it is NOT a RegEx
				ofs = pos + 1;
			}
			else if (codeMode == CodeModeNone && ch == 60 && ch1 == 37) { //start of code
				codeMode = (template.charCodeAt(ofs + 2) != 61) ? CodeModeInCode : CodeModeInCodePrint;
				var pos = ofs;

				//convert template from 'nonCodeBlockStart' to 'pos' to a print function
				ret = convertToPrint(template, nonCodeBlockStart, pos);
				template = ret.template;
				pos = ret.ofs;

				//reset template pointer and convert the tag to spaces
				if (codeMode == CodeModeInCode) {
					template = template.substr(0, pos) + "  " + template.substr(pos + 2);
				}
				else {
					template = template.substr(0, pos) + "   " + template.substr(pos + 3);
				}
				//insert "echo("
				if (codeMode == CodeModeInCodePrint) {
					template = template.substr(0, pos) + "echo(htmlentities(" + template.substr(pos);
					pos += 18;
				}
				//reset template pointer
				ofs = pos;
			}
			else if (codeMode != CodeModeNone && ch == 37 && ch1 == 62) { //end of code
				var prevCodeMode = codeMode;
				codeMode = CodeModeNone;
				nonCodeBlockStart = ofs;
				//close echo if print mode
				if (prevCodeMode == CodeModeInCodePrint) {
					template = template.substr(0, nonCodeBlockStart) + "));" + template.substr(nonCodeBlockStart);
					nonCodeBlockStart += 3;
				}
				//convert the tag to spaces
				template = template.substr(0, nonCodeBlockStart) + "  " + template.substr(nonCodeBlockStart + 2);
				nonCodeBlockStart += 2;

				//if after tag, there are only spaces/tabs and the new line, then skip them
				while (nonCodeBlockStart < template.length) {
					ch = template.charCodeAt(nonCodeBlockStart);
					if (ch != 32 && ch != 9)
						break;
					nonCodeBlockStart++;
				}
				if (nonCodeBlockStart < template.length) {
					ch = template.charCodeAt(nonCodeBlockStart);
					if (ch == 10)
						nonCodeBlockStart++;
					else if (ch == 13)
						nonCodeBlockStart += (template.charCodeAt(nonCodeBlockStart + 1) == 10) ? 2 : 1;
				}
				ofs = nonCodeBlockStart;
			}
			else if (codeMode == CodeModeInCode && ch == 47 && ch1 == 47) { //single-line comment
				ofs += 2;
				//skip line comment
				while (ofs < template.length) {
					ch = template.charCodeAt(ofs);
					if (ch == 13 || ch == 10)
						break;
					ofs++;
				}
				while (ofs < template.length) {
					ch = template.charCodeAt(ofs);
					if (ch != 13 && ch != 10)
						break;
					ofs++;
				}
			}
			else if (codeMode == CodeModeInCode && ch == 47 && ch1 == 42) { //multi-line comment
				ofs += 2;
				//skip multi-line comment
				while (ofs < template.length) {
					ch = template.charCodeAt(ofs);
					if (ch == 42 && ofs + 1 < template.length && template.charCodeAt(ofs + 1) == 47) {
						ofs += 2;
						break;
					}
					ofs++;
				}
			}
			else {
				ofs++;
			}
		}
		else {
			var idx = template.indexOf('\\', ofs);
			if (idx < 0)
				idx = template.length;
			var idx2 = template.indexOf(String.fromCharCode(chQuote), ofs);
			if (idx2 < 0)
				idx2 = template.length;
			if (idx < idx2) {
				//got a \
				if (idx < template.length - 1) {
					ch = template.charCodeAt(idx + 1);
					if (ch == chQuote || ch == 92)
						ofs = idx + 2;
				}
				else {
					ofs = idx + 1;
				}
			}
			else if (idx2 < template.length) {
				chQuote = 0;
				ofs = idx2 + 1;
			}
			else {
				ofs = template.length;
			}
		}
	}
	//must end in non-template mode
	if (codeMode != CodeModeNone) {
		throw new SyntaxError("Unexpected end of file reached while template tag open", filename);
	}

	//convert final block of template from 'nNonCodeBlockStart' to 'nCurrPos' to a print function
	ret = convertToPrint(template, nonCodeBlockStart, ofs);
	//done
	return ret.template;
}

function convertToPrint(template, nonCodeBlockStart, currOfs)
{
	var ret = {};
	var ch;

	while (nonCodeBlockStart < currOfs) {
		//insert a call to 'echo' method
		template = template.substr(0, nonCodeBlockStart) + "echo(\"" + template.substr(nonCodeBlockStart);
		nonCodeBlockStart += 6;
		currOfs += 6;

		//escape quotes and convert control chars
		while (nonCodeBlockStart < currOfs) {
			var ch = template.charCodeAt(nonCodeBlockStart);

			if (ch == 13 || ch == 10)
				break;
			if (ch == 34 || ch == 9 || ch == 92) {
				if (ch == 9)
					ch = 116; //t
				template = template.substr(0, nonCodeBlockStart) + "\\" + String.fromCharCode(ch) + template.substr(nonCodeBlockStart + 1);
				nonCodeBlockStart += 2;
				currOfs++;
			}
			else if (ch < 32) {
				template = template.substr(0, nonCodeBlockStart) + template.substr(nonCodeBlockStart + 1);
				currOfs--;
			}
			else {
				nonCodeBlockStart++;
			}
		}
		if (nonCodeBlockStart < currOfs) {
			//the template ended with a \r, \n or \r\n pair.
			//we leave them in order to maintain line numbering with original template but we close the echo sentence
			//adding the correct chars
			ch = template.charCodeAt(nonCodeBlockStart);
			if (ch == 13) {
				if (nonCodeBlockStart + 1 < currOfs && template.charCodeAt(nonCodeBlockStart + 1) == 10) {
					template = template.substr(0, nonCodeBlockStart) + "\\r\\n\");" + template.substr(nonCodeBlockStart);
					nonCodeBlockStart += 7 + 2; //plus 2 because the \r\n
					currOfs += 7;
				}
				else {
					template = template.substr(0, nonCodeBlockStart) + "\\r\");" + template.substr(nonCodeBlockStart);
					nonCodeBlockStart += 5 + 1; //plus 1 because the \r
					currOfs += 5;
				}
			}
			else {
				template = template.substr(0, nonCodeBlockStart) + "\\n\");" + template.substr(nonCodeBlockStart);
				nonCodeBlockStart += 5 + 1; //plus 1 because the \n
				currOfs += 5;
			}
		}
		else {
			//the template ended so close the ECHO sentence
			template = template.substr(0, nonCodeBlockStart) + "\");" + template.substr(nonCodeBlockStart);
			nonCodeBlockStart += 3;
			currOfs += 3;
		}
	}

	ret.template = template;
	ret.ofs = currOfs;
	return ret;
}
