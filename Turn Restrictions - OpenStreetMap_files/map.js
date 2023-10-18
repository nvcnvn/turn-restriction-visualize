/**
 * This file is licensed under Creative Commons Zero (CC0)
 * http://creativecommons.org/publicdomain/zero/1.0/
 *
 * Author: http://www.openstreetmap.org/user/Zartbitter
 * with assistance by http://www.openstreetmap.org/user/tyr_asd
 */

var map;
var markerLayergroup;
var warningsLayergroup;
var errorsLayergroup;
var memberLayer;
var ajaxActive = false;

// some default values
var minZoom = 14;
var angleStraight = 45;
var angleSide = 85;
var angleUTurn = 85;
var oldBounds = [-200, -200, -200, -200];
var maxClusterRadius = 10;
var iconSize = 20;
if (L.Browser.mobile) {
	iconSize = 32;
}
var josmBuffer = [0.0005, 0.0001];

/**
 * Define my icon class
 */
RestrIcon = L.Icon.extend({
	options: {
		iconUrl: 'images/unknown.png',
		iconSize: [iconSize, iconSize],
		iconAnchor: [iconSize/2, iconSize/2],
		popupAnchor: [0, 2-(iconSize/2)]
	}
});

/**
 * Convenience method for creating an instance of my icon class
 */
L.restrIcon = function (options) {
    return new RestrIcon(options);
};

/**
 * Define my icon class
 */
RotRestrIcon = L.DivIcon.extend({
	options: {
		iconSize: [iconSize, iconSize],
		iconAnchor: [iconSize/2, iconSize/2],
		popupAnchor: [0, 2-(iconSize/2)], //??
      html: '<img src="images/unknown.png" width="'+iconSize+'" height="'+iconSize+'"/>',
      className: "",
	}
});

/**
 * Convenience method for creating an instance of my icon class
 */
L.rotRestrIcon = function (options) {
    return new RotRestrIcon(options);
};

/**
 * Get all parameters out of the URL.
 * @return Array List of URL parameters key-value indexed
 */
function getUrlParameters() {
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
	for(var i=0; i<hashes.length; i++) {
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}
	return vars;
}

/**
 * MinZoom was changed in preferences dialog.
 */
function changedMinZoom() {
	minZoom = document.getElementById("inputminzoom").value;
}

/**
 * Deviation angle for "straight" was changed in preferences dialog.
 */
function changedAngleStraight() {
	angleStraight = document.getElementById("inputanglestraight").value;
}

/**
 * Deviation angle for "left/right" was changed in preferences dialog.
 */
function changedAngleSide() {
	angleSide = document.getElementById("inputangleside").value;
}

/**
 * Deviation angle for "u turn" was changed in preferences dialog.
 */
function changedAngleUTurn() {
	angleUTurn = document.getElementById("inputangleuturn").value;
}

/**
 * Hides the information div regardless of its previous state.
 */
function hideInfo() {
	document.getElementById("infodiv").style.display = "none";
}

/**
 * Hides the preferences div regardless of its previous state.
 */
function hidePref() {
	document.getElementById("prefdiv").style.display = "none";
}

/**
 * Show some preferences used for calculating errors and warnings.
 */
function togglePref() {
	hideInfo();

	var prefdiv = document.getElementById("prefdiv");
	if (prefdiv.style.display == "block") {
		prefdiv.style.display = "none";
	} else {
		prefdiv.style.display = "block";
	}
}

/**
 * Show some information what this map does and what it doesn't.
 */
function toggleInfo() {
	hidePref();

	var infodiv = document.getElementById("infodiv");
	if (infodiv.style.display == "block") {
		infodiv.style.display = "none";
	} else {
		infodiv.style.display = "block";
	}
}

/**
 * Debug: dump object.
 */
function dump(arr, level) {
	var dumpedText = "";
	if (!level) {
		level = 0;
	}

	// limit recursion to reduce possibility of "too much recursion"
	if (level > 1) {
		return "===>" + arr + "<===(" + typeof arr + ")\n";
	}

	// the padding given at the beginning of the line
	var level_padding = "";
	for (var j=0; j<level+1; j++) {
		level_padding += "    ";
	}

	if(typeof arr == "object") { // Array/Hashes/Objects 
		for (var item in arr) {
			var val = arr[item];

			if(typeof val == "object") { // if it is an array
				dumpedText += level_padding + "'" + item + "' ...\n";
				dumpedText += dump(val, level+1);
			} else {
				dumpedText += level_padding + "'" + item + "' => \"" + val + "\"\n";
			}
		}
	} else { // Strings/Chars/Numbers etc.
		dumpedText = "===>" + arr + "<===(" + typeof arr + ")";
	}
	return dumpedText;
}

/**
 * Give some feedbach to the user.
 * @param text Some text to display on the map
 */
function setProgress(text) {
	document.getElementById("progress").innerHTML = text;
}

/**
 * Debug: dump object to progress area.
 */
function debugPrint(obj, name, noalert) {
	var prefix = "";
	if (typeof name != "undefined") {
		prefix = name;
	}
	setProgress("<b>" + prefix + "</b><pre>" + dump(obj) + "</pre>");
	if (!noalert) {
		alert("Debug " + prefix);
	}
}

/**
 * Clone the source object.
 * We do not want to have a reference here.
 * @var source The source object
 * @return The cloned object
 */
function clone(source) {
	var newObj = new Array();
	for (var i in source) {
		if (typeof source[i] == 'object') {
			newObj[i] = new clone(source[i]);
		} else {
			newObj[i] = source[i];
		}
	}
	return newObj;
}

/**
 * Callback for successful geolocation.
 * @var position Geolocated position
 */
function foundLocation(position) {
	if (typeof map != "undefined") {
		var lat = position.coords.latitude;
		var lon = position.coords.longitude;
		map.setView(new L.LatLng(lat, lon), 15);
	}
}

/**
 * Build a HTML link for OSM to browse the OSM object.
 * @var id The id of the object
 * @var type The type of the object (node/way/relation), default is relation
 * @return The HTML link as a string
 */
function browseLink(id, type) {
	if (type == undefined) {
		type = 'relation';
	}
	return '<a href="https://www.openstreetmap.org/browse/' + type + '/' + id + '" target="_blank" class="memberlink">' + id + '</a>';
}

/**
 * Tell me if more than one "to" ways are allowed for this restriction type.
 * @var restrictionType type of restrection (e.g, no_u_turn, only_right_turn, ...)
 * @return Boolean true if more than one "to" ways are allowed, otherwise false
 */
function moreThanOneToWaysAllowed(restrictionType) {
	var retValue = false;
	switch (restrictionType) {
		case "no_exit":
			retValue = true;
			break;
	}
	return retValue;
}

/**
 * Tell me if more than one "from" ways are allowed for this restriction type.
 * @var restrictionType type of restrection (e.g, no_u_turn, only_right_turn, ...)
 * @return Boolean true if more than one "from" ways are allowed, otherwise false
 */
function moreThanOneFromWaysAllowed(restrictionType) {
	var retValue = false;
	switch (restrictionType) {
		case "no_entry":
			retValue = true;
			break;
	}
	return retValue;
}

/**
 * Check the geometry of the elements and get endnodes as candidates for marker placement.
 * The geometry has to be star-like, if there is more than one member. That means all members
 * have to be ways and all ways share one endnode.
 * @param restriction the turn restriction
 * @param elements array of members of one role to this restriction
 * @param membertype the role the members have got inside the restriction
 * @return Array of nodes
 */
function checkStarGetEndnodes(restriction, elements, memberType) {

	var endNodes = new Array();

	// checking with no or only one element doesn't make sense, just return the endnodes
	if (elements.length == 0) {
		return endNodes;
	}
	if (elements.length == 1) {
		var elem = elements[0];
		if (elem.type == "node") {
			endNodes.push(elem);
		}
		if (elem.type == "way") {
			endNodes.push(elem.nodes[0]);
			endNodes.push(elem.nodes[elem.nodes.length - 1]);
		}
		return endNodes;
	}

	// now we have more than one element
	// every element should be a way but we don't know what mappers do

	// collect first and last node of ways as candidates for endnodes
	var tmpNodes = new Array();
	for (var i=0, j=elements.length; i<j; i++) {
		var elem = elements[i];

		// node: is an error here, but we will collect it as a candidate
		if (elem.type == "node") {
			tmpNodes[elem.id] = elem;
			continue;
		}
		// way: collect first and last node 
		if (elem.type == "way") {
			// way: collect first and last node 
			tmpNodes[elem.nodes[0].id] = elem.nodes[0];
			tmpNodes[elem.nodes[elem.nodes.length - 1].id] = elem.nodes[elem.nodes.length - 1];
		}
	}

	// now check if all ways start or end in one common node
	var centerNodes = new Array();
	var first = true;
	for (var i=0, l=elements.length; i<l; i++) {
		var elem = elements[i];
		if (elem.type == "way") {
			if (first) {
				centerNodes.push(elem.nodes[0].id);
				centerNodes.push(elem.nodes[elem.nodes.length - 1].id);
				first = false;
			} else {
				var commonNodes = new Array();
				for (j=0; j<centerNodes.length; j++) {
					if (centerNodes[j] == elem.nodes[0].id || centerNodes[j] == elem.nodes[elem.nodes.length - 1].id) {
						commonNodes.push(centerNodes[j]);
					}
				}
				centerNodes = clone(commonNodes);
			}
		}
	}

	if (centerNodes.length < 1) {
		restriction.errors.push("\"" + memberType + "\" members do not connect at a single node");
		// no center node found, use complete list of endnodes
		for (var i in tmpNodes) {
			endNodes.push(tmpNodes[i]);
		}
	} else {
		// use center node(s) as endnodes
		for (var i=0; i<centerNodes.length; i++) {
			endNodes.push(tmpNodes[centerNodes[i]]);
		}
	}
	return endNodes;
}

/**
 * Check if the restriction members of one role form a single way if they are ways.
 * Return all end nodes, that means nodes which are not connected among one other way. 
 * @var restriction The restriction
 * @var elements the restriction members of one role
 * @var memberType The role
 * @return Array List of end nodes
 */
function checkLineGetEndnodes(restriction, elements, memberType) {

	var endNodes = new Array();

	// checking with no or only one element doesn't make sense, just return the endnodes
	if (elements.length == 0) {
		return endNodes;
	}
	if (elements.length == 1) {
		var elem = elements[0];
		if (elem.type == "node") {
			endNodes.push(elem);
		}
		if (elem.type == "way") {
			endNodes.push(elem.nodes[0]);
			endNodes.push(elem.nodes[elem.nodes.length - 1]);
		}
		return endNodes;
	}

	// now we have more than one element - every element has to be a way.
	// count the different endnodes (first and last node) of all ways.
	// if all ways form one proper way then exactely 2 nodes should be found only once.
	var tmpEndNodes = new Array();
	var tmpEndNodesCount = new Array();
	var nodesInsteadOfWays = new Array();
	for (var i=0, j=elements.length; i<j; i++) {
		var elem = elements[i];

		// check if element is a node
		if (elem.type == "node") {
			// add this node later, because it is an error here
			nodesInsteadOfWays.push(elem);
			continue;
		}

		// check if element is a way
		if (elem.type != "way") {
			// ignore this element
			continue;
		}

		// remember first node of this way and count it
		var nodeId = elem.nodes[0].id;
		tmpEndNodes["" + nodeId] = elem.nodes[0];
		if (typeof tmpEndNodesCount["" + nodeId] == "undefined") {
			tmpEndNodesCount["" + nodeId] = 1;
		} else {
			tmpEndNodesCount["" + nodeId] += 1;
		}

		// remember last node of this way and count it
		nodeId = elem.nodes[elem.nodes.length-1].id;
		tmpEndNodes["" + nodeId] = elem.nodes[elem.nodes.length-1];
		if (typeof tmpEndNodesCount["" + nodeId] == "undefined") {
			tmpEndNodesCount["" + nodeId] = 1;
		} else {
			tmpEndNodesCount["" + nodeId] += 1;
		}
	}
	// end nodes are the only one occurring only once, not twice or more times
	for (var id in tmpEndNodesCount) {
		if (tmpEndNodesCount[id] == 1) {
			endNodes.push(tmpEndNodes[id]);
		}
	}
	// ways are continuous if there are 2 end nodes left in the array
	if (endNodes.length > 0 && endNodes.length != 2) {
		restriction.errors.push("\"" + memberType + "\" members do not form a straight way");
	}
	// Now add nodes which where used as members where there should be ways only
	endNodes = endNodes.concat(nodesInsteadOfWays);
	return endNodes;
}

/**
 * Test if all members of each restriction are properly connected.
 * @var restrictions Array of all restrictions
 * @return Array of all restrictions with updated errors and warnings
 */
function checkMemberConnections(restrictions) {

	for (var i=0, l=restrictions.length; i<l; i++) {
		var endNodesFrom = new Array();
		var endNodesVia = new Array();
		var endNodesTo = new Array();

		var restr = restrictions[i];

		endNodesFrom = checkStarGetEndnodes(restr, restr.from, "from");
		endNodesVia = checkLineGetEndnodes(restr, restr.via, "via");
		endNodesTo = checkStarGetEndnodes(restr, restr.to, "to");

		// check connection from-via
		var idxConnectedViaFrom = -1;
		if (endNodesFrom.length > 0 && endNodesVia.length > 0) {
			var connected = false;
			for (var j=0; j<endNodesVia.length; j++) {
				var endNodeVia = endNodesVia[j];
				for (var k=0; k<endNodesFrom.length; k++) {
					var endNodeFrom = endNodesFrom[k];
					if (endNodeVia.id == endNodeFrom.id) {
						connected = true;
						idxConnectedViaFrom = j;
						break;
					}
				}
				if (connected) {
					break;
				}
			}
			if (!connected) {
				restr.errors.push("\"from\" not properly connected to \"via\"");
			}
		}

		// check connection via-to
		var idxConnectedViaTo = -1;
		if (endNodesTo.length > 0 && endNodesVia.length > 0) {
			var connected = false;
			for (var j=0; j<endNodesVia.length; j++) {
				var endNodeVia = endNodesVia[j];
				for (var k=0; k<endNodesTo.length; k++) {
					var endNodeTo = endNodesTo[k];
					if (endNodeVia.id == endNodeTo.id) {
						connected = true;
						idxConnectedViaTo = j;
						break;
					}
				}
				if (connected) {
					break;
				}
			}
			if (!connected) {
				restr.errors.push("\"to\" not properly connected to \"via\"");
			}
		}

		// when there's a via way: check that this via way is used for connection, not only one node of this way
		if (endNodesVia.length > 1 && idxConnectedViaFrom == idxConnectedViaTo && idxConnectedViaFrom != -1) {
			restr.errors.push("\"from\" and \"to\" are connected at a node but there is a \"via\" way");
		}

		// remember the end nodes, we will need it to decide where to put the marker on the map
		restr.endnodesfrom = endNodesFrom;
		restr.endnodesvia = endNodesVia;
		restr.endnodesto = endNodesTo;
	}
	return restrictions;
}

/**
 * Check the existance of a highway or railway tag on a member way.
 * If there's only a railway tag add a warning to the restriction.
 * If there's no highway tag and no railway tag add an error to the restriction.
 * @var restriction The restriction
 * @var member The member way
 * @var role The role of the member (from/via/to)
 */
function checkHighwayTag(restriction, member, role) {

	var text = "\"" + role + "\" member "
				+ browseLink(member.id, member.type)
				+ " without highway tag";

	if (typeof member.tags != "undefined") {
		if (typeof member.tags.highway != "undefined" || (typeof member.tags.route != "undefined" && member.tags.route == "ferry")) {
			; // ok
		} else if (typeof member.tags.railway != "undefined") {
			restriction.warnings.push(text.replace("without highway", "with railway"));
		} else {
			restriction.errors.push(text);
		}
	} else {
		restriction.errors.push(text);
	}
}

/**
 * Check the object type (way/node) and the count of "to" members for every role for this restriction.
 * Errors and warnings found will be added to the restriction's array of errors/warnings.
 * @var restriction The restriction
 * @return restriction
 */
function checkMembersTypeCountTo(restriction) {

	var to = restriction["to"];

	if (to.length == 0) {
		restriction.errors.push("\"to\" member is missing");
		return;
	} 

	if (to.length > 1) {
		if (moreThanOneToWaysAllowed(restriction.restriction)) {
			restriction.warnings.push("more than one \"to\" member found. In my opinion it is clearer to have one restriction for each direction.");
		} else {
			restriction.errors.push("more than one \"to\" member found ");
		}
	}
	for (var i=0; i<to.length; i++) {
		var member = to[i];
		if (member.type == "way") {
			// check for highway tag
			checkHighwayTag(restriction, member, "to");
		} else {
			restriction.errors.push("\"to\" member is not a way "
				+ browseLink(member.ref, member.type));
		}
	}
}

/**
 * Check the object type (way/node) and the count of "via" members for every role for this restriction.
 * Errors and warnings found will be added to the restriction's array of errors/warnings.
 * @var restriction The restriction
 * @return restriction
 */
function checkMembersTypeCountVia(restriction) {

	var via = restriction["via"];
	if (via.length == 0) {
		restriction.errors.push("\"via\" member is missing");
	} else if (via.length == 1) {
		var member = via[0];
		if (member.type == "way") {
			checkHighwayTag(restriction, member, "via");
		} else if (member.type != "node") {
			restriction.errors.push("\"via\" member has wrong type, only way or node is allowed"
				+ browseLink(member.id, member.type));
		}
	} else {
		for (var i=0; i<via.length; i++) {
			var member = via[i];
			if (member.type == "way") {
				checkHighwayTag(restriction, member, "via");
			} else {
				restriction.errors.push("\"via\" member "
					+ browseLink(member.id, member.type)
					+ " is " + (member.type == "node" ? "a node" : "not a way")
					+ ", but there is more than 1 \"via\" member "
					);
			}
		}
	}
}

/**
 * Check the object type (way/node) and the count of "from" members for every role for this restriction.
 * Errors and warnings found will be added to the restriction's array of errors/warnings.
 * @var restriction The restriction
 * @return restriction
 */
function checkMembersTypeCountFrom(restriction) {

	var from = restriction["from"];
	if (from.length == 0) {
		restriction.errors.push("\"from\" member is missing");
	} else {
		if (from.length > 1) {
			if (moreThanOneFromWaysAllowed(restriction.restriction)) {
				restriction.warnings.push("more than one \"from\" member found. In my opinion it is clearer to have one restriction for each direction.");
			} else {
				restriction.errors.push("more than one \"from\" member found ");
			}
		}
		for (var i=0; i<from.length; i++) {
			var member = from[i];
			if (member.type == "way") {
				// check for highway tag
				checkHighwayTag(restriction, member, "from");
			} else {
				restriction.errors.push("\"from\" member is "
					+ (member.type == "node" ? "a node " : "not a way ") //not a way "
					+ browseLink(member.ref, member.type));
			}
		}
	}
	return restriction;
}

/**
 * Check the object type (way/node) and the count of all restrictions members for every role.
 * Errors and warnings found will be added to the restriction's array of errors/warnings.
 * @var Array restrictions List of restrictions
 * @return Array List of restrictions
 */
function checkMembersTypeCount(restrictions) {
	for (var i=0, j=restrictions.length; i<j; i++) {
		var restr = restrictions[i];
		// check "from", "via" and "to" members of this restriction
		checkMembersTypeCountFrom(restr);
		checkMembersTypeCountVia(restr);
		checkMembersTypeCountTo(restr);
	}
	return restrictions;
}

/**
 * Check the restriction type.
 * Checks for missing, unknown or multiple restriction values.
 * @var relation The relation stub ar received through Overpass API
 * @var errors Array to collect the error messages
 * @var warnings Array to collect the warning messages
 */
function checkRestrictionType(relation, errors, warnings) {
	// check if relation has a restriction tag (including "sub"-restrictions like restriction:hgv)
	var count = 0;
	var standard = false;
	var subRestriction = "";
	var differentSubValues = false;

	for (var key in relation.tags) {
		// ignore some restriction:* tags with different semantics
		if (key == "restriction:type" || key == "restriction:source") {
			continue;
		}
		if (key == "restriction") {
			if (!differentSubValues && subRestriction != "" && subRestriction != relation.tags[key]) {
				differentSubValues = true;
			}
			subRestriction = relation.tags[key]; // just note it to check if subrestrictions have the same type
			standard = true;
			count++;
		} else if (key.length > 12 && key.substring(0, 12) == "restriction:") {
			if (!differentSubValues && subRestriction != "" && subRestriction != relation.tags[key]) {
				differentSubValues = true;
			}
			subRestriction = relation.tags[key];
			count++;
		}
	}

	if (differentSubValues) {
		errors.push("relation with multiple restriction values");
	}

	//if (count > 1) {
	//	warnings.push("relation with more than 1 restriction tag");
	//}

	if (count > 0 && !standard) {
		// create a dummy entry for restriction tag to get subrestrictions work
		relation.tags["restriction"] = subRestriction;
		relation.tags["_dummy_restriction"] = true;
	}

	if (count == 0) {
		// error: no restriction tag found
		errors.push("relation without restriction tag");
	} else {
		// check for conditional restriction
		var rtag = relation.tags.restriction;
		var regresu = /(.*)\s*@\s*(.*)/.exec(rtag);
		if (regresu) {
			rtag = regresu[1].trim();
			relation.tags.restriction_orig = relation.tags.restriction;
			relation.tags.restriction = rtag;
		}
		// check if restriction tag is a known tag
		switch (rtag) {
			case "only_left_turn":
			case "only_right_turn":
			case "only_straight_on":
			case "no_left_turn":
			case "no_right_turn":
			case "no_u_turn":
			case "no_straight_on":
			case "no_exit":
			case "no_entry":
				// everything's fine
				break;
			default:
				errors.push("relation with unknown restriction tag");
				break;
		}
	}
}

/**
 * Check if there's an conditional restriction cancelling a oneway condition.
 * @param tags the list of tags of the way
 * @return true if there's a conditional restriction
 */
function checkConditionalOnewayNo(tags) {
	var conditional = false;
	for (var key in tags) {
		if (key.length > 7 && key.substr(0, 7) == 'oneway:') { // && tags[key] == 'no') {
			conditional = true;
		}
	}
	return conditional;
}

/**
 * Check if ways with oneway direction have the correct orientation with reference to fromNodes or toNodes.
 * Only fromNodes or toNodes should be passed, not both. Use an empty array for unused parameter.
 * Errors are added to the restrictions's errors collection.
 * @param restriction The restriction
 * @param role the role of the mebers from/via/to and pseudo role notto
 * @param way The way to check
 * @param fromNodes Array of nodes with at least one being start or end of the member ways
 * @param toNodes Array of nodes with at least one being start or end of the member ways
 * @return true if everythings looks fine, false if at least one ways has the wrong orientation
 */
function checkOnewayDirection(restriction, role, way, fromNodes, toNodes) {

	var printRole = '"' + (role == "notto" ? "to" : role) + '" ';

	for (var i=0, j=fromNodes.length; i<j; i++) {
		if (fromNodes[i].id == way.nodes[0].id) {
			if (way.tags.oneway == "-1" && role != "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " in opposite to oneway direction");
					return false;
				}
			}
			if (way.tags.oneway == -1 && role == "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " forbids to enter oneway in wrong direction 1");
					return false;
				}
			}
		}
		if (fromNodes[i].id == way.nodes[way.nodes.length-1].id) {
			if (way.tags.oneway != "-1" && role != "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " in opposite to oneway direction");
					return false;
				}
			}
			if (way.tags.oneway != -1 && role == "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " forbids to enter oneway in wrong direction 2");
					return false;
				}
			}
		}
	}

	for (var i=0, j=toNodes.length; i<j; i++) {
		if (toNodes[i].id == way.nodes[0].id) {
			if (way.tags.oneway != "-1" && role != "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " in opposite to oneway direction");
					return false;
				}
			}
			if (way.tags.oneway != "-1" && role == "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " forbids to enter oneway in wrong direction 3");
					return false;
				}
			}
		}
		if (toNodes[i].id == way.nodes[way.nodes.length-1].id) {
			if (way.tags.oneway == "-1" && role != "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " in opposite to oneway direction");
					return false;
				}
			}
			if (way.tags.oneway == "-1" && role == "notto") {
				if (checkConditionalOnewayNo(way.tags)) {
					restriction.warnings.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " is in opposite to oneway direction but there's a conditional restriction oneway:*. Please check it carefully");
				} else {
					restriction.errors.push(printRole + "member "
						+ browseLink(way.id, way.type)
						+ " forbids to enter oneway in wrong direction 4");
					return false;
				}
			}
		}
	}

	return true;
}

/**
 * Check if ways with oneway direction have the correct orientation with reference to fromNodes or toNodes.
 * Only fromNodes or toNodes should be passed, not both. 
 * @param restriction The restriction
 * @param role the role of the mebers from/via/to and pseudo role notto
 * @param members Array of relation members
 * @param fromNodes Array of nodes with at least one being start or end of the member ways
 * @param toNodes Array of nodes with at least one being start or end of the member ways
 * @return true if everythings looks fine, false if at least one ways has the wrong orientation
 */
function checkOnewaysDirection(restriction, role, members, fromNodes, toNodes) {
	var ok = true;
	for (var i=0; i<members.length; i++) {
		var member = members[i];
		if (member.type != "way") {
			continue;
		}
		if (typeof member.tags.oneway == "undefined" || member.tags.oneway == "" || member.tags.oneway == "no") {
			// it's no oneway road
			continue;
		}
		ok = checkOnewayDirection(restriction, role, member, fromNodes, toNodes);
		if (!ok) {
			break;
		}
	}
	return ok;
}

/**
 * Check if way members of restrictions do not lead in opposite direction of oneway roads.
 * Do not check restrictions already having some errors.
 * We want to check only otherwise valid restrictions for simplicicity.
 * @var restrictions Array of restrictions
 * @return Array of restrictions
 */
function checkAgainstOneways(restrictions) {

	for (var i=0, j=restrictions.length; i<j; i++) {
		var restr = restrictions[i];
		var ok = true;

		// do only check restrictions without errors yet
		if (restr.errors.length > 0) {
			continue;
		}

		ok = checkOnewaysDirection(restr, "from", restr.from, new Array(), restr.endnodesvia);
		if (ok) {
			// use pseudo role "notto" for "to" members of "no_" restrictions
			var toRole = restr.restriction.substring(0,3) == "no_" ? "notto" : "to";
			ok = checkOnewaysDirection(restr, toRole, restr.to, restr.endnodesvia, new Array());
		}
		if (ok) {
			if (restr.via.length > 1) {
				// TODO: check if via elements form a polyline with correct oneway orientation for each member
			} else {
				ok = checkOnewaysDirection(restr, "via", restr.via, restr.endnodesfrom, new Array());
			}
		}
		if (!ok) {
		}
	}
	return restrictions;
}

/**
 * Collect all member objects for the relations and put them in collections
 * according to their role. Because each relation as received from Overpass API
 * only has id and role info for its members.
 * Resolving members down to nodes with coordinates isn't done here.
 * @var relations Array of relations as read from Overpass API
 * @var ways Array of ways as read from Overpass API
 * @var nodes Array of nodes as read from Overpass API
 * @return Array of relations each one having from, via, to and unknown members collections
 */
function collectRestrictionMembers(relations, ways, nodes) {
	var restrictions = new Array();

	for (var i in relations) {

		var r_from = new Array();
		var r_via = new Array();
		var r_to = new Array();
		var r_unknown = new Array();
		var errors = new Array();
		var warnings = new Array();
		var restr = new Array();

		var rel = relations[i];

		// check if restriction has a restriction tag
		checkRestrictionType(rel, errors, warnings);

		// read members of restriction
		for (var j in rel.members) {

			var member = rel.members[j];

			if (typeof member.role == "undefined") {
				errors.push("member "
					+ browseLink(member.ref, member.type)
					+ " without role");
				r_unknown.push(member);
				continue;
			}

			switch (member.role) {
				case "from":
					r_from.push(member);
					break;
				case "via":
					r_via.push(member);
					break;
				case "to":
					r_to.push(member);
					break;
				case "location_hint":
					// ignore location_hint
					break;
				case "":
					r_unknown.push(member);
					errors.push("member "
						+ browseLink(member.ref, member.type)
						+ " without role");
					break;
				default:
					r_unknown.push(member);
					errors.push("member "
						+ browseLink(member.ref, member.type)
						+ " with unknown role");
					break;
			}
		}

		restr["from"] = r_from;
		restr["via"] = r_via;
		restr["to"] = r_to;
		restr["unknown"] = r_unknown;
		restr["id"] = rel.id;

		// read what kind of restriction it is
		if (typeof rel.tags.restriction == "undefined") {
			restr["restriction"] = "";
		} else {
			restr["restriction"] = rel.tags.restriction;
		}

		restr["errors"] = errors;
		restr["warnings"] = warnings;
		restr["tags"] = rel.tags;
		restrictions.push(restr);
	}

	return restrictions;
}

/**
 * The way as read from the relation gets resolved down to its nodes including their coordinates.
 * @param way the way stub from the relation
 * @param nodes The nodes collected from the Overpass API call
 * @return way with its nodes in instvar way.nodes
 */
function resolveWay(way, nodes) {
	var nodesNew = new Array();
	for (var i=0, j=way.nodes.length; i<j; i++) {
		var node = nodes[""+way.nodes[i]];
		nodesNew.push(clone(node));
	}
	way.nodes = nodesNew;
	return way;
}

/**
 * The relation members belonging to one role will be resolved down to their nodes including
 * their coordinates.
 * @param restriction the restriction
 * @param elements the members belonging to one role
 * @param ways The ways as collected from the Overpass API call
 * @param nodes The nodes collected from the Overpass API call
 * @return Array of members where node ids are resolved to nodes with coordinates
 */
function resolveRelationMember(restriction, elements, ways, nodes) {

	var elems = new Array();
	for (var i=0; i<elements.length; i++) {
		var elem = elements[i];
		switch (elem.type) {
			case "node":
				var node = nodes[elem.ref];
				elems.push(clone(node));
				break;
			case "way":
				var way = ways["" + elem.ref];
				way = resolveWay(clone(way), nodes);
				elems.push(way);
				break;
			default:
				restriction.errors.push("member " + browseLink(elem.ref, elem.type) + " is neither way nor node ");
				break;
		}
	}
	return elems;
}

/**
 * The relation members are only stubs with type and id. All relation members will be
 * resolved down to their nodes including their coordinates.
 * @param restriction the restriction
 * @param ways The ways as collected from the Overpass API call
 * @param nodes The nodes collected from the Overpass API call
 * @return Array of restrictions where all node ids are resolved to nodes with coordinates
 */
function resolveRelationMembers(restrictions, ways, nodes) {
	var restrictionsNew = new Array();

	for (var i=0, j=restrictions.length; i<j; i++) {
		var restr = restrictions[i];
		restr.from = resolveRelationMember(restr, restr.from, ways, nodes);
		restr.via = resolveRelationMember(restr, restr.via, ways, nodes);
		restr.to = resolveRelationMember(restr, restr.to, ways, nodes);
		restr.unknown = resolveRelationMember(restr, restr.unknown, ways, nodes);
		restrictionsNew.push(restr);
	}
	return restrictionsNew;
}

/**
 * Decide which node should be used to place the marker on the map.
 * First we try to use the via node. If there's a via way use the
 * endin node connecting to the "from2" member if available.
 * If no "via" is available try "from", "to" or unknown role members.
 * Place the marker node in each restriction's markernode instvar.
 * @param restrictions List of restrictions
 * @return List of restrictions
 */
function calculateMarkerPositions(restrictions) {

	for (var rIdx=0, len=restrictions.length; rIdx<len; rIdx++) {
		var restr = restrictions[rIdx];

		// first: check "via" candidates
		if (restr.endnodesvia.length == 1) {
			// only one "via" candidate - just take it
			restr.markernode = clone(restr.endnodesvia[0]);
			continue;
		} else if (restr.endnodesvia.length > 1) {
			// more "via" candidates - try to get the one connect to "from"
			if (restr.endnodesfrom.length > 0) {
				for (var v=0; v<restr.endnodesvia.length; v++) {
					for (var f=0; f<restr.endnodesfrom.length; f++) {
						if (restr.endnodesvia[v].id == restr.endnodesfrom[f].id) {
							restr.markernode = clone(restr.endnodesvia[v]);
							continue;
						}
					}
					if (typeof restr.markernode != "undefined") continue;
				}
			} else {
				// no "from" candidate - just take one "via" candidate
				restr.markernode = clone(restr.endnodesvia[0]);
				continue;
			}
		}
		if (typeof restr.markernode != "undefined") continue;

		// no "via" candidates available - try "from" candidates
		if (restr.endnodesfrom.length == 1) {
			restr.markernode = clone(restr.endnodesfrom[0]);
			continue;
		} else if (restr.endnodesfrom.length > 1) {
			restr.markernode = clone(restr.endnodesfrom[0]); // default
			// look if a node is conected to "to" and use this one
			var found = false;
			for (var fIdx=0; fIdx<restr.endnodesfrom.length; fIdx++) {
				for (var tIdx=0; tIdx<restr.endnodesto.length; tIdx++) {
					if (restr.endnodesfrom[fIdx].id == restr.endnodesto[tIdx].id) {
						restr.markernode = clone(restr.endnodesfrom[fIdx]);
						found = true;
						break;
					}
				}
				if (found) {
					break;
				}
			}
			continue;
		}

		// use "to" candidates if still no marker position is found
		if (restr.endnodesto.length > 0) {
			restr.markernode = clone(restr.endnodesto[0]);
			continue;
		}

		// use "unknown" candidates if still no marker position is found
		if (restr.unknown.length > 0) {
			var obj = restr.unknown[0];
			if (obj.type == "node") {
				restr.markernode = clone(obj);
				continue;
			} else if (obj.type == "way") {
				restr.markernode = clone(obj.nodes[0]);
				continue;
			}
		}

		// still no marker position found - this is a bug
		alert("Imternal error: No marker position found for relation " + restr.id);
	}
	return restrictions;
}

/**
 * Remove the layer containing restriction member vectors.
 */
function removeMemberLayer() {
	if (typeof memberLayer != "undefined" && memberLayer != null && map.hasLayer(memberLayer)) {
		map.removeLayer(memberLayer);
		memberLayer.clearLayers();
		memberLayer = null;
	}
}

/**
 * Get the style for a restriction member based on its type and role.
 * @var type node or way
 * @var role from, via, to or unknown
 * @return Array with style values
 */
function getRestrictionMemberDrawStyle(type, role) {
	var style = new Array();
	style["opacity"] = 0.7;

	// type specific values
	switch (type) {
		case "node":
			style["radius"] = 13;
			style["fillOpacity"] = 0.9;

			break;
		case "way":
			style["weight"] = 8;
			break;
	}

	// role specific values
	switch (role) {
		case "from":
			style["color"] = 'blue';
			break;
		case "via":
			style["color"] = 'black';
			break;
		case "to":
			style["color"] = 'green';
			break;
		case "notto":
			style["color"] = 'red';
			break;
		default:
			style["color"] = 'yellow';
			break;
	}

	style["fillColor"] = style["color"];
	return style;
}

/**
 * Draw a node.
 * @param member the node
 * @param role the node's role in the restriction
 * @param memberVectors An array to collect all drawing features
 */
function drawRestrictionMemberNode(member, role, memberVectors) {
	var style = getRestrictionMemberDrawStyle("node", role);
	memberVectors.push(L.circleMarker([member.lat, member.lon], {
			color: style.color,
			fillColor: style.fillColor,
			fillOpacity: style.fillOpacity,
			radius: style.radius,
			opacity: style.opacity
		}
	).bindLabel(role.replace('notto', 'not to')));
}

/**
 * Draw a way.
 * @param member the way
 * @param role the way's role in the restriction
 * @param memberVectors An array to collect all drawing features
 */
function drawRestrictionMemberWay(member, role, memberVectors) {
	var style = getRestrictionMemberDrawStyle("way", role);
	var latlons = new Array();

	for (var i=0, j=member.nodes.length; i<j; i++) {
		latlons.push([member.nodes[i].lat, member.nodes[i].lon]);
	}

	memberVectors.push(L.polyline(latlons, {
			color: style.color,
			opacity: style.opacity,
			weight: style.weight
	}).bindLabel(role.replace('notto', 'not to')));
}

/**
 * Draw a restriction member.
 * @param member the member
 * @param role the member's role in the restriction
 * @param memberVectors An array to collect all drawing features
 */
function drawRestrictionMember(member, role, memberVectors) {
	removeMemberLayer();
	switch (member.type) {
		case "node":
			drawRestrictionMemberNode(member, role, memberVectors);
			break;
		case "way":
			drawRestrictionMemberWay(member, role, memberVectors);
			break;
		default:
			// do nothing
			break;
	}
}

/**
 * Draw all restriction members. The layer where the drawings are defined
 * is in global var memberLayer to have access to it from other methods.
 * @param restriction the restriction
 */
function drawRestriction(restriction) {
	var memberVectors = new Array();

	for (var i=0; i<restriction.from.length; i++) {
		drawRestrictionMember(restriction.from[i], "from", memberVectors);
	}

	// use pseudo role "notto" for "to" members of "no_" restrictions
	var toRole = restriction.restriction.substring(0,3) == "no_" ? "notto" : "to";
	for (var i=0; i<restriction.to.length; i++) {
		drawRestrictionMember(restriction.to[i], toRole, memberVectors);
	}

	for (var i=0; i<restriction.unknown.length; i++) {
		drawRestrictionMember(restriction.unknown[i], "unknown", memberVectors);
	}

	for (var i=0; i<restriction.via.length; i++) {
		drawRestrictionMember(restriction.via[i], "via", memberVectors);
	}

	// create layer and add it to the map
	memberLayer = L.layerGroup(memberVectors);
	memberLayer.addTo(map);
}

/**
 * Get one boundingbox enclosing all given members and the given boundingbox.
 * @param members Array of members (nodes and ways)
 * @param bbox existing boundingbox
 * @return Array new boundingbox
 */
function getRestrictionBoundingBoxMembers(members, bbox) {
	for (var i=0; i<members.length; i++) {
		if (members[i].type == "node") {
			bbox[0] = Math.min(bbox[0], members[i].lon);
			bbox[1] = Math.max(bbox[1], members[i].lon);
			bbox[2] = Math.min(bbox[2], members[i].lat);
			bbox[3] = Math.max(bbox[3], members[i].lat);
		} else if (members[i].type == "way") {
			for (j=0, k=members[i].nodes.length; j<k; j++) {
				bbox[0] = Math.min(bbox[0], members[i].nodes[j].lon);
				bbox[1] = Math.max(bbox[1], members[i].nodes[j].lon);
				bbox[2] = Math.min(bbox[2], members[i].nodes[j].lat);
				bbox[3] = Math.max(bbox[3], members[i].nodes[j].lat);
			}
		}
	}
	return bbox;
}

/**
 * Get one boundingbox enclosing all members of the given restriction.
 * @param restr The restriction
 * @return Array boundingbox
 */
function getRestrictionBoundingBox(restr) {
	var bbox = [200, -200, 200, -200];
	bbox = getRestrictionBoundingBoxMembers(restr.from, bbox);
	bbox = getRestrictionBoundingBoxMembers(restr.via, bbox);
	bbox = getRestrictionBoundingBoxMembers(restr.to, bbox);
	bbox = getRestrictionBoundingBoxMembers(restr.unknown, bbox);
	// add buffer
	bbox[0] -= josmBuffer[0];
	bbox[1] += josmBuffer[0];
	bbox[2] -= josmBuffer[1];
	bbox[3] += josmBuffer[1];
	return bbox;
}

/**
 * Check for some restrictions if the angle between "from" ant "to" correlates to the restriction tpe.
 * If it looks suspicious add a warning to the restriction.
 * @param restr The restriction
 * @param rot the rotation angle of the "from" way as calculated before
 */
function checkAngle(restr, rot) {
	// check only restriction without errors and with only one "to" way and with a single "via" node
	if (restr.errors.length > 0 || restr.to.length > 1 || restr.via.length > 1 || restr.via[0].type != "node") {
		return;
	}

	var to = restr.to[0];
	var to1, to2;

	// calculate angle of "to" way
	if (restr.markernode.id == to.nodes[0].id) {
		to1 = to.nodes[0];
		to2 = to.nodes[1];
	} else {
		to1 = to.nodes[to.nodes.length-1];
		to2 = to.nodes[to.nodes.length-2];
	}
    to1.lng = to1.lon;
    to2.lng = to2.lon;
    var dx,dy, rot2;
    dx = (L.CRS.EPSG3857.project(to2).x-L.CRS.EPSG3857.project(to1).x);
    dy = (L.CRS.EPSG3857.project(to2).y-L.CRS.EPSG3857.project(to1).y);
    rot2 = 90-Math.atan(dy/dx)*180/Math.PI;
    if (dx<0) rot2 += 180;

	var dif = rot2-rot;
	// normalize dif to [-180, 180]
    if (dif<=-180) dif += 360;
    if (dif>180) dif -= 360;

	// check normalized dif dependent on restriction type
	// warn with deviation of standard angle instead of angle alone
	switch (restr.restriction) {
		case "only_straight_on":
		case "no_straight_on":
			if (Math.abs(dif) > angleStraight) {
				restr.warnings.push('Really ' + restr.restriction + '? Deviation angle is ' + Math.abs(Math.round(dif*10)/10) + '°');
			}
			break;
		case "only_left_turn":
		case "no_left_turn":
			if (dif > 0 || Math.abs(dif) < 90-angleSide || Math.abs(dif) > 90+angleSide) {
				restr.warnings.push('Really ' + restr.restriction + '? Deviation angle is ' + Math.round(Math.abs(-90-dif)*10)/10 + '°');
			}
			break;
		case "only_right_turn":
		case "no_right_turn":
			if (dif < 0 || Math.abs(dif) < 90-angleSide || Math.abs(dif) > 90+angleSide) {
				restr.warnings.push('Really ' + restr.restriction + '? Deviation angle is ' + Math.round(Math.abs(90-dif)*10)/10 + '°');
			}
			break;
		case "no_u_turn":
			if (Math.abs(dif) < 180-angleUTurn) {
				restr.warnings.push('Really ' + restr.restriction + '? Deviation angle is ' + Math.round((180-Math.abs(dif))*10)/10 + '°');
			}
			break;
	}
}

/**
 * Calculate icon rotation angle.
 * @param restr the restriction
 * @return rotation angle
 */
function calcIconRotation(restr) {

    var from1,from2;
    if ((restr.endnodesvia && restr.endnodesvia[0] && restr.endnodesfrom && restr.endnodesfrom[0]) &&
    	(restr.endnodesvia[0].id == restr.endnodesfrom[0].id || 
        (restr.endnodesvia[1] && restr.endnodesvia[1].id == restr.endnodesfrom[0].id))) {
      from2 = restr.from[0].nodes[0];
      from1 = restr.from[0].nodes[1];
    } else {
      var fnc = restr.from[0].nodes.length-1;
      from2 = restr.from[0].nodes[fnc];
      from1 = restr.from[0].nodes[fnc-1];
    }
    from1.lng = from1.lon;
    from2.lng = from2.lon;
    var dx,dy, rot;
    dx = (L.CRS.EPSG3857.project(from2).x-L.CRS.EPSG3857.project(from1).x);
    dy = (L.CRS.EPSG3857.project(from2).y-L.CRS.EPSG3857.project(from1).y);
    rot = 90-Math.atan(dy/dx)*180/Math.PI;
    if (dx<0) rot += 180;

	return rot;
}

/**
 * Get all vehicle types if there are restriction:* tags.
 * @param restr The restriction
 * @return Array all vehicle types
 */
function getRestrictionVehicleTypes(restr) {
	var types = new Array();
	var all = false;
	for (var key in restr.tags) {
		if (key == "restriction" && !restr.tags._dummy_restriction) {
			all = true;
		} else if (key.length > 12 && key.substring(0, 12) == "restriction:"
				&& key != "restriction:type"
				&& key != "restriction:source"
				&& key != "restriction:conditional") {
			types.push(key.substring(12));
		}
	}
	if (types.length > 0 && all) {
		types.unshift('all');
	}
	return types;
}

/**
 * For each restriction a marker will be added to the map.
 * @var restrictions Array of restrictions
 */
function addMarkers(restrictions) {

	markerLayergroup.clearLayers();
	errorsLayergroup.clearLayers();
	warningsLayergroup.clearLayers();

	var markers = new Array();

	for (var i=0, l=restrictions.length; i<l; i++) {

		var restr = restrictions[i];
		var options;
		var popupImage;
		var postfix = "";

		// calculate icon rotation if there are no errors (otherwise there's probably no via available)
		var rot = restr.errors.length > 0 ? 0 : calcIconRotation(restr);

		// check the angle between from and to for some turn restrictions
		checkAngle(restr, rot);

		// change icon for restrictions with warnings
		if (restr.warnings.length > 0) {
			postfix = "_warning";
		}

		switch (restr.restriction) {
			case "only_straight_on":
			case "only_right_turn":
			case "only_left_turn":
			case "no_left_turn":
			case "no_right_turn":
			case "no_u_turn":
			case "no_straight_on":
			case "no_exit":
			case "no_entry":
				options = {icon: L.rotRestrIcon({html: '<img src="images/' + restr.restriction + postfix + '.png" '
						+ 'width="' + iconSize + '" height="' + iconSize + '" '
						+ 'style="transform:rotate(' + rot + 'deg); -o-transform:rotate(' + rot + 'deg); -moz-transform:rotate(' + rot + 'deg); '
						+ '-webkit-transform:rotate(' + rot + 'deg); -ms-transform:rotate(' + rot + 'deg);"/>'}), restriction: clone(restr) };
				popupImage = "images/" + restr.restriction + ".png";
				break;
			default:
				options = {icon: L.restrIcon({iconUrl: "images/unknown.png"}), restriction: clone(restr) };
				popupImage = "images/unknown.png";
				break;
		}

		// change icon if the restriction is faulty
		if (restr.errors.length > 0) {
			options = {
				icon: L.restrIcon({iconUrl: "images/error.png"})
				, restriction: clone(restr)
			};
		}

		var bbox = getRestrictionBoundingBox(restr);
		var vehicleTypes = getRestrictionVehicleTypes(restr);

		var popupText = '<table><tr><td>' + '<img src="' + popupImage + '" /></td><td>'
						+ '<div><b>Turn restriction</b> "' + restr.restriction + '"</div>'
						+ (restr.tags["restriction:conditional"] ? "<div><b>Condition: </b>" + restr.tags["restriction_orig"] + "</div>" : "")
						+ (vehicleTypes.length > 0 ? "<div>applies to: " + vehicleTypes.join(", ") + "</div>" : "")
						+ (restr.tags.except ? "<div>except: " + restr.tags.except + "</div>" : "")
						+ '<div class="popuplink">Id = <a href="https://www.openstreetmap.org/browse/relation/'
						+ restr.id + '" target="_blank">' + restr.id + '</a></div>'
						+ '<span class="popuplink">Edit in <a href="https://www.openstreetmap.org/edit?lat=' + restr.markernode.lat
						+ "&lon=" + restr.markernode.lon + '&zoom=18" target="_blank">OSM</a> '
						+ 'or <a href="http://localhost:8111/load_and_zoom?left=' + bbox[0]
						+ "&right=" + bbox[1] + "&bottom=" + bbox[2] + "&top=" + bbox[3] + "&select=relation" + restr.id
						+ '" target="hiddenIframe">JOSM</a> (<a href="https://localhost:8112/load_and_zoom?left=' + bbox[0]
						+ "&right=" + bbox[1] + "&bottom=" + bbox[2] + "&top=" + bbox[3] + "&select=relation" + restr.id
						+ '" target="hiddenIframe">https</a>)</span>'
						+ '</td></tr></table>';

		if (restr.errors.length > 0) {
			popupText += "<hr><b>Error" + (restr.errors.length == 1 ? "" : "s") + ":</b><ul>";
			for (var j=0; j<restr.errors.length; j++) {
				popupText += "<li>" + restr.errors[j] + "</li>";
			}
			popupText += '</ul>';
		}

		if (restr.warnings.length > 0) {
			popupText += "<hr><b>Warning" + (restr.warnings.length == 1 ? "" : "s") + ":</b><ul>";
			for (var j=0; j<restr.warnings.length; j++) {
				popupText += "<li>" + restr.warnings[j] + "</li>";
			}
			popupText += '</ul>';
		}

		if (typeof restr.markernode == "undefined") {
			alert("Internal error: no markernode for restriction " + restr.id);
			continue;
		}
		var marker = L.marker([restr.markernode.lat, restr.markernode.lon], options)
						.bindPopup(popupText)
						.on('click', function(e) {
								// draw members on click, because some mobiles do not send mouseover events
								drawRestriction(e.target.options.restriction);
							})
						.on('mouseover', function(e) {
								drawRestriction(e.target.options.restriction);
							})
						;

		if (restr.errors.length > 0) {
			errorsLayergroup.addLayer(marker);
		} else if (restr.warnings.length > 0) {
			warningsLayergroup.addLayer(marker);
		} else {
			markerLayergroup.addLayer(marker);
		}
	}
}

/**
 * Read and parse the JSON data got from Overpass API.
 * Adds the markers to the marker layers.
 * @var Object response JSON data
 */
function readResponse(response) {

	if (!response) {
		ajaxActive = false;
		setProgress("Got empty response");
		return;
	}

	var nodes = new Array();
	var ways = new Array();
	var restrictions = new Array();

	setProgress("Parsing turn restrictions ...");
	for (var i=0, j=response.elements.length; i<j; i++) {
		var obj = response.elements[i];
		if (obj.type == "node") {
			nodes[""+obj.id] = obj;
		}
		if (obj.type == "way") {
			ways[""+obj.id] = obj;
		}
		if (obj.type == "relation") {
			restrictions[""+obj.id] = obj;
		}
	}

	ajaxActive = false;
	restrictions = collectRestrictionMembers(restrictions, ways, nodes);

	// resolve restriction member references, get way or node objects
	restrictions = resolveRelationMembers(restrictions, ways, nodes);

	// check restriction
	restrictions = checkMembersTypeCount(restrictions);
	restrictions = checkMemberConnections(restrictions);
	restrictions = checkAgainstOneways(restrictions);

	// calculate marker position
	restrictions = calculateMarkerPositions(restrictions);

	setProgress("Placing markers ...");
	addMarkers(restrictions);

	// count restrictions with errors or warnings for progress label
	var countErrors = 0;
	var countWarnings = 0;
	for (var i=0, j=restrictions.length; i<j; i++) {
		if (restrictions[i].errors.length > 0) {
			countErrors++;
		} else if (restrictions[i].warnings.length > 0) {
			countWarnings++;
		}
	}
	var text = "Found " + (restrictions.length == 0 ? "no" : ""+restrictions.length)
			+ " turn restriction" + (restrictions.length == 1 ? "" : "s");
	text += '<div class="indent">';
	if (countErrors > 0) {
		text += "" + countErrors + " with errors";
	}
	if (countWarnings > 0) {
		text += (countErrors > 0 ? "<br />" : "") + countWarnings + " with warnings";
	}
	text += "</div>";
	setProgress(text);
}

/**
 * Check if browser is MS IE 8 or older.
 * @return Boolean true if MS IE 8 or older is detected, else false
 */
function isOldMsIe() {
    if (navigator.appName == 'Microsoft Internet Explorer') {
        var ua = navigator.userAgent;
        var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
        if (re.exec(ua) != null) {
            rv = parseFloat(RegExp.$1);
			return rv < 9;
		}
    }
    return false;
}

/**
 * Returns the URL for fetching restriction data from Overpass API.
 * @var BoundingBox boundingbox as used in map.getBounds()
 * @return String URL
 */
function getApiUrl(boundingbox) {
	var overpassUrl = 'https://overpass-api.de/api/interpreter?data=[out:json];(relation["restriction:conditional"~""]('
			+ boundingbox.getSouthWest().lat
			+ "," + boundingbox.getSouthWest().lng
			+ "," + boundingbox.getNorthEast().lat
			+ "," + boundingbox.getNorthEast().lng
		+ ");>;);out;";
	return overpassUrl;
}

/**
 * Moving the map just ended.
 * Check if the new bounds are outside of the old bounds.
 * Fetch the data from Overpass API and read/parse it.
 * @var event e not used here
 */
function onMoveEnd(e) {

	// do not send more than one ajax request
	if (ajaxActive) {
		return;
	}

	// check if zoom value is ok
	if (map.getZoom() < minZoom) {
		markerLayergroup.clearLayers();
		errorsLayergroup.clearLayers();
		warningsLayergroup.clearLayers();
		setProgress("Please zoom in to view turn restrictions.<br />At least zoom " + minZoom
					+ " is required. Zoom is now " + map.getZoom());
		return;
	}

	// check if new bounds are inside old bounds. In this case do nothing
	var newBounds = [map.getBounds().getSouthWest().lat
					, map.getBounds().getSouthWest().lng
					, map.getBounds().getNorthEast().lat
					, map.getBounds().getNorthEast().lng];
	if (newBounds[0] >= oldBounds[0] && newBounds[1] >= oldBounds[1] && newBounds[2] <= oldBounds[2] && newBounds[3] <= oldBounds[3]) {
		oldBounds = newBounds; // set oldBounds to reread restrictions on zooming out
		setProgress("Zoomed in");
		return;
	}

	setProgress("Reading turn restrictions ...");
	oldBounds = newBounds;

	if (!$.support.cors) {
		if (isOldMsIe()) {
			// For IE8 just write an error message, do not set $.support.cors to true and do not try to fetch data
			setProgress("<span class=\"red\">Sorry, Internet Explorer 8 (or older) is not supported.</span>");
		} else {
			setProgress("<span class=\"red\">Warning:</span> Maybe your browser does not support fetching restriction data.<br />"
						+ "In that case the map will stop working. But I'll try it anyway ...");
			$.support.cors = true;
		}
	}
	if ($.support.cors) {
		ajaxActive = true;
		$.ajax({
			type: "GET",
			url: getApiUrl(map.getBounds()),
			dataType: "json",
			crossDomain: true,
			error: function (jqXHR, textStatus, errorThrown) {
				ajaxActive = false;
				setProgress('<div class="red bold">Error fetching restriction data</div> ' + errorThrown);
			},
			success: function (response) {
				readResponse(response);
			}
		});
	}
}

/**
 * Moving the map just startet.
 * Change the progress message.
 * @var e event (not used)
 */
function onMoveStart(e) {
	hideInfo();
	hidePref();
	removeMemberLayer();
	setProgress("Moving ...");
}

/**
 * Initialize the map.
 */
function initMap() {

	var standard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors</a>'
		});

	var standardbw = L.tileLayer.grayscale('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors</a>'
		});

	var mapnikde = L.tileLayer('http://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png', {
		maxZoom: 18,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors</a>'
		});

	var cyclemap = L.tileLayer('http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png', {
		maxZoom: 18,
		attribution: 'Data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors</a>'
			+ 'Tiles courtesy of <a href="http://www.opencyclemap.org/" target="_blank">Andy Allan</a>'
		});

	/*var bwmapnik = L.tileLayer('http://{s}.www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png', {
		subdomains: ["a","b","c"],
		maxZoom: 18,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors</a>'
		});*/

	/*var mbgray = L.tileLayer("http://{s}.tiles.mapbox.com/v3/zartbitter.map-3o9vk31p/{z}/{x}/{y}.png", {
		maxZoom: 18, subdomains: ["a", "b", "c", "d"], attribution: '<a href="http://mapbox.com/about/maps">Mapbox Terms</a>'
	});*/

	markerLayergroup   = new L.MarkerClusterGroup({maxClusterRadius: maxClusterRadius,
			spiderfyDistanceMultiplier: 2, showCoverageOnHover: false});
	warningsLayergroup = new L.MarkerClusterGroup({maxClusterRadius: maxClusterRadius,
			spiderfyDistanceMultiplier: 2, showCoverageOnHover: false});
	errorsLayergroup   = new L.MarkerClusterGroup({maxClusterRadius: maxClusterRadius,
			spiderfyDistanceMultiplier: 2, showCoverageOnHover: false});

	var useGeolocation = true;
	var zoom = 7;
	var lat = 51.58;
	var lon = 10.1;
	var urlParams = getUrlParameters();
	if (typeof urlParams.zoom != "undefined" && typeof urlParams.lat != "undefined" && typeof urlParams.lon != "undefined") {
		zoom = urlParams.zoom;
		lat = urlParams.lat;
		lon = urlParams.lon;
		useGeolocation = false;
	}

	map = L.map('map', {
		center: new L.LatLng(lat, lon),
		zoom: zoom,
		layers: [standardbw, markerLayergroup, warningsLayergroup, errorsLayergroup]
	});
	map.attributionControl.setPrefix("");

	var baseMaps = {
		"Grayscale": standardbw
	//	, "Simple Gray": mbgray
		, "OSM Standard": standard
		, "OSM.de Style": mapnikde
	//	, "Cycle Map": cyclemap
	//	, "BW Mapnik": bwmapnik
	};

	var overlayMaps = {
		"Turn restrictions": markerLayergroup
		, " - with warnings": warningsLayergroup
		, " - with errors": errorsLayergroup
	};

	//map.addControl(L.flattrButton({ buttonType: 'countercompact', flattrUrl: 'http://map.comlu.com/', popout: 0 }));
	//map.addControl(L.flattrButton({ flattrId: '1171746' }));
	var layerControl = L.control.layers(baseMaps, overlayMaps, {collapsed: false}).addTo(map);
	map.addControl(new L.Control.Permalink({layers: layerControl, useAnchor: false, position: 'bottomright'}));

	map.on('movestart', onMoveStart);
	map.on('moveend', onMoveEnd);
	onMoveEnd(null);
	if (useGeolocation && typeof navigator.geolocation != "undefined") {
		navigator.geolocation.getCurrentPosition(foundLocation);
	}
}

