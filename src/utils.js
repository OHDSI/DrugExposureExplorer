	// ASSUMES JSON!!!!!!!


// adapted from cachedAjax in ohdsi.utils
import LZString from 'lz-string';
import _ from 'lodash';
var d3 = require('d3');
var ALLOW_CACHING = [
	'.*',
	//'/WebAPI/[^/]+/person/',
];

//var cache = {}; // only save till reload
//var cache = localStorage; // save indefinitely
var cache = sessionStorage; // save for session
export function cachedJsonFetch(url, opts={}) {	
	var allowed = _.find(ALLOW_CACHING, allowedUrl => url.match(allowedUrl));
	if (allowed) {
		//console.log(`using cache for ${url}. remove ${allowed} from ohdsi.util.ALLOW_CACHING to disable caching for it`);
	} else {
		//console.log(`not caching ${url}. add to ohdsi.util.ALLOW_CACHING to enable caching for it`);
		return jsonFetch(url, opts);
	}
	var key = `${url}:${JSON.stringify(opts)}`;
	return new Promise(function(resolve, reject) {
		if (!storageExists(key, cache)) {
			jsonFetch(url, opts)
			.then(function(json) {
					storagePut(key, json, cache);
					//console.log('caching', key);
					resolve(json);
				});
		} else {
			var results = storageGet(key, cache);
			//console.log('already cached', key, results);
			resolve(results);
		}
	});
}
function jsonFetch(url, opts={}) {
	return fetch(url, opts)
		.then(function(results) {
			return results.json();
		});
}
export function cachedPostJsonFetch(url, params={}, queryName) {
	var qs = _.map(params, (v,k) => `${k}=${v}`).join('&');
	var get = `${url.replace(/post/,'get').replace(/Post/,'Get')}?${qs}`;
	console.log(queryName, get);
	return cachedJsonFetch(url, {
						method: 'post',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(params),
					}).then(function(json) {
            if (json.error) {
              json.error.url = get;
              json.error.queryName = queryName;
            }
            json.url = get;
            json.queryName = queryName;
            return json;
          })
}
export function storagePut(key, val, store = sessionStorage) {
	store[key] = LZString.compressToBase64(JSON.stringify(val));
}
export function storageExists(key, store = sessionStorage) {
	return _.has(store, key);
}
export function storageGet(key, store = sessionStorage) {
	return JSON.parse(LZString.decompressFromBase64(store[key]));
}

/* SvgLayout class
	* manages layout of subcomponents in zones of an svg
	* initialize with layout like:
		var layout = new SvgLayout(w, h,
				// zones:
				{
					top: { margin: { size: 5}, }, // top zone initialized with margin
																				// 5 pixels (or whatever units) high
					bottom: { margin: { size: 5}, },
					left: { margin: { size: 5}, },
					right: { margin: { size: 5}, },
				})
	* add components to zones like one of these:
		
		// size is constant:
		layout.add('left','axisLabel', { size: 20 })

		// size returned by function:
		layout.add('left','axisLabel', { size: ()=>axisLabel.node().getBBox().width * 1.5 })

		// provide svg element to get size from (must specify 'width' or 'height' as dim)
		layout.add('left','axis', { obj: cp.y.axisG.node(), dim:'width' })

	* retrieve dimensions of svg chart area (inside all zones):
		layout.svgWidth()
		layout.svgHeight()
	* retrieve svg dimensions:
		layout.w()
		layout.h()
	* retrieve total size of zone
		layout.zone('bottom')
	* retrieve total size of one zone element
		layout.zone('left.margin')
	* retrieve total size of more than one zone element
		layout.zone(['left.margin','left.axisLabel'])
	* y position of bottom zone:
		layout.h() - layout.zone('bottom')
	* 
	* when adding zones, you can also include a position func that will
	* do something based on the latest layout parameters
	*
		var position = function(layout) {
			// positions element to x:left margin, y: middle of svg area
			axisLabel.attr("transform", 
				`translate(${layout.zone(["left.margin"])},
										${layout.zone(["top"]) + (h - layout.zone(["top","bottom"])) / 2})`);
		}
		layout.add('left','axisLabel', { size: 20 }, position: position)
	*
	* whenever you call layout.positionZones(), all registered position functions 
	* will be called. the position funcs should position their subcomponent, but 
	* shouldn't resize them (except they will, won't they? because, e.g.,
	* the y axis needs to fit after the x axis grabs some of the vertical space.
	* but as long as left and right regions don't change size horizontally and top
	* and bottom don't change size vertically, only two rounds of positioning
	* will be needed)
	*/
export class SvgLayout {
	constructor(w, h, zones) {
		this._w = w;
		this._h = h;
		['left','right','top','bottom'].forEach(
			zone => this[zone] = _.cloneDeep(zones[zone]));
		this.chart = {};
	}
	svgWidth() {
		return this._w - this.zone(['left','right']);
	}
	chartWidth(...args) {
		return this.svgWidth(...args);
	}
	svgHeight() {
		return this._h - this.zone(['top','bottom']);
	}
	chartHeight(...args) {
		return this.svgHeight(...args);
	}
	w(_w) {
    if (typeof _w !== 'undefined') this._w = _w;
		return this._w;
	}
	h(_h) {
    if (typeof _h !== 'undefined') this._h = _h;
		return this._h;
	}
	zone(zones) {
		zones = typeof zones === "string" ? [zones] : zones;
		var size = _.chain(zones)
								.map(zone=>{
									var zoneParts = zone.split(/\./);
									if (zoneParts.length === 1 && this[zoneParts]) {
										return _.values(this[zoneParts]);
									}
									if (zoneParts.length === 2 && this[zoneParts[0]][zoneParts[1]]) {
										return this[zoneParts[0]][zoneParts[1]];
									}
									throw new Error(`invalid zone: ${zone}`);
								})
								.flatten()
								.map(d=>{
											return d.obj ? d.obj.getBBox()[d.dim] : functor(d.size)();
								})
								.sum()
								.value();
		//console.log(zones, size);
		return size;
	};
	add(zone, componentName, config) {
		return this[zone][componentName] = config;
	}
	positionZones() {
		return _.chain(this)
			.map(_.values)
			.compact()
			.flatten()
			.map('position')
			.compact()
			.each(position=>position(this))
			.value();
	}
}
function functor(val, ...args) { // d3.functor gone in d3.v4
	if (typeof val === "function")
		return val(...args);
	return () => val;
}

export const commify = d3.format(',');

