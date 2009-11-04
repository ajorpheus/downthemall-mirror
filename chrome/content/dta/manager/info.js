/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is DownThemAll!
 *
 * The Initial Developers of the Original Code are Stefano Verna and Federico Parodi
 * Portions created by the Initial Developers are Copyright (C) 2004-2007
 * the Initial Developers. All Rights Reserved.
 *
 * Contributor(s):
 *    Stefano Verna <stefano.verna@gmail.com>
 *    Nils Maier <MaierMan@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import('resource://dta/timers.jsm');
var Timers = new TimerManager();


var Dialog = {
	downloads: null,
	get isFullyDisabled() {
		return $('directory', 'renaming', 'hash').every(
			function(e) {
				return e.hasAttribute('disabled');
			}
		);
	},
	load: function DTA_load() {
		try {
			// d is an Array of Downloads
			this.downloads = window.arguments[0];
			if (this.downloads.length == 1) {
				let d = this.downloads[0];
				$("infoIcon").src = d.largeIcon;
				$("infoURL").value = d.urlManager.url.spec;
				$("infoDest").value = d.destinationFile;
				document.title = d.destinationName;
			
				if (d.referrer) {
					$('sourcePage')._value = $("sourcePage").value = d.referrer.spec;
				}
				if (!d.isOf(FINISHING, COMPLETE)) {
					$('sourcePage').removeAttribute('readonly');
				}
				
				$('renaming').value = d.mask;
				$('directory').value = d.pathName;
				$('hash').value = d.hash;
				$('description').value = d.description;
				this.item = d;
				Tooltip.start(d);
			}
			else {
				// more than just one download
				$('infoDest').value = document.title;
				for each (let e in $('infoURL', 'infoSize', 'sourcePage')) {
					e.value = "---";
				}
				$("hash").setAttribute('readonly', 'true');
				$("hash").setAttribute('disabled', 'true');
	
				let mask = this.downloads[0].mask;
				$('renaming').value = 
					this.downloads.every(function(e, i, a) { return e.mask == mask; })
					? mask
					: '';
	
				let dir = String(this.downloads[0].pathName);
				$('directory').value = 
					this.downloads.every(function(e) { return e.pathName == dir; })
					? dir
					: '';
				$('canvasGrid').hidden = true;
			}				
			if (this.downloads.every(function(d) { return d.isOf(COMPLETE, FINISHING); })) {
				for each (let e in $('directory', 'renaming', 'mask', 'browsedir')) {
					e.setAttribute('readonly', 'true');
					e.setAttribute('disabled', 'true');
				}
			}
			if (this.isFullyDisabled) {
				$('dTaDownloadInfo').buttons = 'accept';
			}			
		}
		catch(ex) {
			Debug.log('load', ex);
		}
		window.setTimeout('window.sizeToContent()', 0);
	},
	accept: function DTA_accept() {
		if (this.isFullyDisabled) {
			return true;
		}		
		if (!this.check()) {
			return false;
		}
		
		let win = window.arguments[1];

		let directory = $('directory').value.trim();
		directory = directory.length ? directory.addFinalSlash() : null;
		
		let mask = $('renaming').value;
		mask = mask.length ? mask : null;
		
		var description = $('description').value;
		description = description.length ? description : null;
		
		let sp = $('sourcePage');
		let newRef = null;
		if (!sp.hasAttribute('readonly') && sp._value != sp.value) {
			newRef = sp.value;
		}
		
		if (this.downloads.length == 1) {
			let d = this.downloads[0];
			if ($('hash').isValid) {
				var h = $('hash').value;
				if (!h || !d.hash || h.sum != d.hash.sum) {
					d.hash = h;
					if (h && d.is(COMPLETE)) {
						// have to manually start this guy ;)
						d.verifyHash();
					}
				}
			}
		}
		
		for each (let d in this.downloads) {
			if (!d.isOf(COMPLETE, FINISHING)) {
				if (directory) {
					d.pathName = directory;
				}
				if (mask) {
					d.mask = mask;
				}
			}
			if (description) {
				d.description = description;
			}
			if (newRef) {
				try {
					d.referrer.spec = newRef;
				}
				catch (ex) {
					Debug.log("failed to set referrer to", newRef);
				}
			}
			d.save();
		}
		
		Tooltip.stop();
		return true;
	},
	browseDir: function DTA_browseDir() {
		// let's check and create the directory
		var newDir = Utils.askForDir(
			$('directory').value,
			_("validdestination")
		);
		if (newDir) {
			$('directory').value = newDir;
		}
	},
	manageMirrors: function DTA_manageMirrors() {
		if (this.downloads.length != 1) {
			// only manage single downloads
			return;
		}
		let download = this.downloads[0];
		let mirrors = download.urlManager.toArray();
		openDialog(
			'chrome://dta/content/dta/mirrors.xul',
			null,
			"chrome,dialog,resizable,modal,centerscreen",
			mirrors
		);
		if (mirrors.length) {
			download.urlManager.initByArray(mirrors);
			Debug.logString("New mirrors set " + mirrors);
		}
	},
	check: function DTA_check() {
		var dir = $('directory').value.trim();
		if (!dir.length || !$('renaming').value.trim().length) {
			return false;
		}
		if (!Utils.validateDir(dir)) {
			alert(_('alertinvalidfolder'));
			var newDir = Utils.askForDir(null, _("validdestination"));
			$('directory').value = newDir ? newDir : '';
			return false;
		}
		if (!$('hash').isValid) {
			alert(_('alertinfo'));
			return false;
		}
		return true;
	},
	resize: function() {
		Tooltip.start(this.item);
		return true;
	}
};
addEventListener("resize", function() Dialog.resize(), true);
