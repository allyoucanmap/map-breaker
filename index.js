/* copyright 2019, stefano bovio @allyoucanmap. */

import * as turf from '@turf/turf';
import * as geoProjection from 'd3-geo-projection';

// Utils

const xmlns = 'http://www.w3.org/2000/svg';

var updateElement = function(el, attributes = {}, style = {}) {
    Object.keys(attributes).forEach(key => {
        el.setAttribute(key, attributes[key]);
    });
    Object.keys(style).forEach(key => {
        el.style[key] = style[key];
    });
};

var createElement = function(tag, attributes = {}, style = {}) {
    const el = document.createElementNS(xmlns, tag);
    updateElement(el, attributes, style);
    return el;
};

var transform = function(x, y, rotation) {
    return 'rotate( ' + rotation + ' ' + x + ' ' + y + ' ) translate(' + x + ', ' + y + ')';
};

var rad = function(d) {
    return d * (Math.PI / 180.0);
};

var map = function(val, v1, v2, v3, v4) {
    return v3 + (v4 - v3) * ((val - v1) / (v2 - v1));
}

var scan = function(features, update = function(coords) { return coords; }, replace = true) {
    return features.map(function(feature) {
        const geometryType = feature.geometry && feature.geometry.type;
        const coordinates = geometryType === 'Point' && update([feature.geometry.coordinates], feature.properties || {})
        || geometryType === 'MultiPoint' && update(feature.geometry.coordinates, feature.properties || {})
        || geometryType === 'LineString' && update(feature.geometry.coordinates, feature.properties || {})
        || geometryType === 'MultiLineString' && feature.geometry.coordinates.map(function(coords){ return update(coords, feature.properties || {}); })
        || geometryType === 'Polygon' && feature.geometry.coordinates.map(function(coords){ return update(coords, feature.properties || {}); })
        || geometryType === 'MultiPolygon' && feature.geometry.coordinates
            .map(function(group){ return group.map(function(coords){ return update(coords, feature.properties || {}); }); });
        if (!replace) return feature;
        return {
            ...feature,
            geometry: {
                ...feature.geometry,
                coordinates: geometryType === 'Point' ? coordinates[0] : coordinates
            }
        };
    });
};

var getPathD = function(coordinates, close) {
    return coordinates.reduce(function(data, coord, idx){
        return data + (idx === 0 && 'M' + coord[0] + ' ' + coord[1]
            || idx === coordinates.length - 1 && ', L' + coord[0] + ' ' + coord[1] + (close ? 'Z' : '')
            || ', L' + coord[0] + ' ' + coord[1]);
    }, '');
}

// Components

var Geometry = function(parent, feature) {
    var bbox = turf.bbox(feature);
    var type = turf.getType(feature);
    var coords = turf.getCoords(feature);
    var d = '';
    scan([ feature ], function(coordinates) {
        d = d + getPathD(coordinates, true) + ' ';
    }, false);
    var element = createElement('g');
    var path = createElement('path', {
        'd': d,
        'fill': 'hsl(' + Math.floor(Math.random() * 360) + ', 90%, 95%)',
        'stroke': '#333333',
        'stroke-width': 0.5 
    });
    element.appendChild(path);
    parent.appendChild(element);
    this._path = path;
    this._bbox = bbox;
    this._type = type;
    this._coords = coords;
    this._parent = parent;
    this._element = element;
    this._feature = feature;
    this._rotation = Math.random() * 360;
};

Geometry.prototype.collide = function(ball) {
    var ballPolygon = ball.feature(false);
    var feature = this._feature;
    var hit = ballPolygon.geometry.coordinates[0].filter(function(coords) {
        return turf.booleanPointInPolygon(coords, feature);
    });
    if (!this._collide && (hit[0] || turf.booleanPointInPolygon(ball.position(), feature))) {
        ball.rotate(this._rotation);
        this._collide = true;
        updateElement(this._path, {
            'stroke': '#ff33aa',
            'fill': 'transparent',
            'stroke-width': 3
        });
        return feature;
    }

    if (this._collide && !this._removed) {
        var parent = this._parent;
        var element = this._element;
        setTimeout(function() {
            parent.removeChild(element);
        }, 100);
        this._removed = true;
    }
    return null;
}

var Ball = function(parent, data) {

    var width = data.width;
    var height = data.height;
    var radius = 12;
    var x = width / 2;
    var y = height - radius * 6;
    var rotation = 45;

    var element = createElement('g', {
        transform: transform(x, y, rotation)
    });

    var circle = createElement('circle', {
        cx: 0,
        cy: 0,
        r: radius,
        fill: '#fefeaf',
        stroke: '#333333',
        'stroke-width': 2
    });

    var line = createElement('line', {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: - radius * 2,
        stroke: '#333333',
        'stroke-width': 1
    });

    element.appendChild(circle);
    element.appendChild(line);
    parent.appendChild(element);

    this._element = element;
    this._x = x;
    this._y = y;
    this._rotation = rotation;
    this._radius = radius;
};

Ball.prototype.position = function() {
    return [
        this._x,
        this._y
    ];
}

Ball.prototype.rotate = function(rotation) {
    this._rotation = rotation;
    this._hit = Math.random() + 'HIT';
}

Ball.prototype.move = function(bounds) {
    if (this._stop) return null;
    var minx = bounds[0];
    var miny = bounds[1];
    var maxx = bounds[2];
    var maxy = bounds[3];

    var rotation = this._rotation;
    var speed = 6;
    var deltaX = Math.sin(rad(rotation)) * speed;
    var deltaY = Math.cos(rad(rotation)) * speed;
    var x = this._x + deltaX;
    var y = this._y - deltaY;

    var radius = this._radius;

    updateElement(this._element, {
        transform: transform(x, y, rotation)
    });

    if (x + radius > maxx
    || y - radius < miny
    || x - radius < minx
    || y + radius > maxy) {
        var hit = '';
        var rot = 0;
        var rotError = Math.random() * 10 - 5;
        if (x + radius > maxx) { hit = 'LEFT'; rot = Math.sign(y - this._y) < 0 ? -45 : -135; }
        if (y - radius < miny) { hit = 'TOP'; rot = Math.sign(x - this._x) < 0 ? -135 : 135; }
        if (x - radius < minx) { hit = 'RIGHT'; rot = Math.sign(y - this._y) < 0 ? 45 : -225; }
        if (y + radius > maxy) { hit = 'BOTTOM'; }
        if (y + radius > maxy + radius * 20) { this._stop = true; }

        if (hit !== 'BOTTOM' && this._hit !== hit) this._rotation = rot + rotError;

        this._hit = hit;

    }

    this._x = x;
    this._y = y;
};

Ball.prototype.feature = function(full) {
    const factor = full ? 1 : 0.5;
    const minx = this._x - this._radius * factor;
    const miny = this._y - this._radius * factor;
    const maxx = this._x + this._radius * factor;
    const maxy = this._y + this._radius * factor;
    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [ minx, miny ],
                    [ minx, maxy ],
                    [ maxx, maxy ],
                    [ maxx, miny ]
                ]
            ]
        }

    };
};


Ball.prototype.collide = function(player) {
    var ballPolygon = this.feature(true);
    var playerPolygon = player.feature();
    if (turf.booleanOverlap(ballPolygon, playerPolygon)) {
        this._hit = Math.random() + 'PLAYER';
        this._rotation = player.rotation();
        player.hit();
    }
};

var Force = function(position) {
    this._position = position;
    this._rotation = 0;
    this._time = 0;
    this._mass = 100;
    this._force = 0;
    this._delta = 0;
};

Force.prototype.apply = function(force) {
    if (this._time < 20) {
        this._time += 0.2;
    }
    this._force = force;
    this._start = true;
};

Force.prototype.update = function(bounds) {
    this._delta = this._force * this._time / this._mass;
    if (!this._start) {
        this._time -= 0.1;
        if (this._time <= 0) {
            this._time = 0;
        }
    }
    this._rotation = this._delta * this._time;

    if (Math.abs(this._rotation) > 45) {
        this._rotation = Math.sign(this._delta) * 45;
    }
    this._position += this._delta;
    if (this._position < bounds[0]) this._position = bounds[0];
    if (this._position > bounds[1]) this._position = bounds[1];
    this._start = false;
};

Force.prototype.position = function() {
    return this._position;
};

Force.prototype.rotation = function() {
    return this._rotation;
};

var Player = function(parent, data) {

    var width = data.width;
    var height = data.height;
    var playerWidth = 64;
    var playerHeight = 8;
    var x = width / 2;
    var y = height - playerHeight * 4;
    var rotation = 0;

    var element = createElement('g', {
        transform: transform(x, y, 0)
    });

    var rect = createElement('rect', {
        x: - playerWidth / 2,
        y: - playerHeight / 2,
        width: playerWidth,
        height: playerHeight,
        fill: 'transparent',
        stroke: '#333333',
        'stroke-width': 2
    });

    var line = createElement('line', {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: - playerHeight * 5,
        stroke: '#333333',
        'stroke-width': 1,
        'stroke-dasharray': '5'
    });

    element.appendChild(rect);
    element.appendChild(line);
    parent.appendChild(element);

    this._element = element;
    this._line = line;
    this._rect = rect;
    this._x = x;
    this._y = y;
    this._rotation = rotation;
    this._leftKeyCode = data.leftKeyCode;
    this._rightKeyCode = data.rightKeyCode;
    this._force = new Force(x);
    this._width = playerWidth;
    this._height = playerHeight;
};

Player.prototype.move = function(bounds, keys) {
    if (keys && keys[this._leftKeyCode]) {
        this._force.apply(-20);
    }
    if (keys && keys[this._rightKeyCode]) {
        this._force.apply(20);
    }
    this._force.update([
        bounds[0] + this._width / 2,
        bounds[2] - this._width / 2
    ]);
    this._x = this._force.position();
    updateElement(this._element, {
        transform: transform(this._x, this._y, 0)
    });
    updateElement(this._line, {
        transform: transform(0, 0, this._force.rotation())
    });
};

Player.prototype.feature = function() {
    const minx = this._x - this._width / 2;
    const miny = this._y - this._height / 2;
    const maxx = this._x + this._width / 2;
    const maxy = this._y + this._height / 2;
    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [ minx, miny ],
                    [ minx, maxy ],
                    [ maxx, maxy ],
                    [ maxx, miny ]
                ]
            ]
        }

    };
};

Player.prototype.rotation = function() {
    return this._force.rotation();
};

Player.prototype.hit = function() {
    var rect = this._rect;
    updateElement(rect, {
        stroke: '#ff00ff'
    });
    setTimeout(function() {
        updateElement(rect, {
            stroke: '#333333'
        });
    }, 150);
};

var MapBreaker = function(selector, options) {
    var parent = document.querySelector(selector);

    updateElement(parent, { }, { position: 'relative'});

    var width = 700;
    var height = 700;
    var margin = 10;
    var svg = createElement('svg', {
        viewBox: '0 0 ' + width + ' ' + height
    }, { 
        position: 'absolute',
        width: '100%',
        height: '100%'
    }); 
    var svgBg = createElement('svg', {
        viewBox: '0 0 ' + width + ' ' + height
    }, { 
        position: 'absolute',
        width: '100%',
        height: '100%'
    }); 
    var rect = createElement('rect', {
        x: 0,
        y: 0,
        width,
        height,
        fill: '#f2f2f2'
    });
    var text = createElement('text', {
        x: width / 2,
        y: height / 2 - 20,
        width,
        height,
        fill: '#ddd',
        'text-anchor': 'middle'
    }, {
        'font-family': 'monospace',
        'font-size': '20px'
    });
    var counter = createElement('text', {
        x: width / 2,
        y: height / 2 + 20,
        width,
        height,
        fill: '#ddd',
        'text-anchor': 'middle'
    }, {
        'font-family': 'monospace',
        'font-size': '20px'
    });
    var border = createElement('path', {
        d: getPathD([
            [ margin, height - margin ],
            [ margin, margin ],
            [ width - margin, margin ],
            [ width - margin, height - margin ]
        ], false),
        fill: 'transparent',
        stroke: '#000000'
    });
    var borderSm = createElement('rect', {
        x: margin / 2,
        y: margin / 2,
        width: width - margin,
        height: height - margin,
        fill: 'transparent',
        stroke: '#333333',
        'stroke-width': 0.5
    });

    svgBg.appendChild(rect);
    svgBg.appendChild(text);
    svgBg.appendChild(counter);
    svg.appendChild(border);
    svg.appendChild(borderSm);
    parent.appendChild(svgBg);
    parent.appendChild(svg);

    this._width = width;
    this._height = height;
    this._margin = margin;
    this._svgBg = svgBg;
    this._text = text;
    this._counter = counter;
    this._svg = svg;
    this._parent = parent;
    this._propertyKey = options && options.propertyKey !== undefined ? options.propertyKey : 'name';

    this._ball = new Ball(svg, {
        width,
        height
    });

    var leftKeyCode = options && options.leftKeyCode !== undefined ?  options.leftKeyCode : 65;
    var rightKeyCode = options && options.leftKeyCode !== undefined ?  options.rightKeyCode : 68;

    this._player = new Player(svg, {
        width,
        height,
        leftKeyCode,
        rightKeyCode
    });

    this._keys = { };
    window.addEventListener('keydown', this.keydown.bind(this));
    window.addEventListener('keyup', this.keyup.bind(this));
};

MapBreaker.prototype.keydown = function() {
    if (!this._keys[event.keyCode]) {
        this._keys[event.keyCode] = true;
    }
};

MapBreaker.prototype.keyup = function() {
    if (this._keys[event.keyCode]) {
        this._keys[event.keyCode] = false;
    }
};

MapBreaker.prototype.wall = function(data, projectionName) {
    var svgBg = this._svgBg;
    var projection = geoProjection[projectionName] && geoProjection[projectionName]();
    var features = scan(
        data.features,
        function(coords) {
            return coords.map(function(coord) {
                var projected = projection && projection(coord) || coord;
                return projected;
            })
        }
    );

    var extent = turf.bbox({ ...data, features });
    var extentWidth = extent[2] - extent[0];
    var extentHeight = extent[3] - extent[1];
    var margin = this._margin;
    var width = this._width - margin * 2;
    var height = width * extentHeight / extentWidth;
    
    const geometries = scan(
            features,
            function(coords) {
                return coords.map(function(coord) {
                    return [
                        map(coord[0], extent[0], extent[2], margin, margin + width),
                        map(coord[1], extent[projection ? 1 : 3], extent[projection ? 3 : 1], margin, margin + height)
                    ];
                })
            }
        ).map(function(feature) {
            return new Geometry(svgBg, feature);
        });

    this._geometries = geometries;
    this._extent = extent;
}

MapBreaker.prototype.loop = function() {
    var ball = this._ball;
    var player = this._player;
    var text = this._text;
    var counter = this._counter;
    var keys = this._keys;
    var width = this._width;
    var height = this._height;
    var margin = this._margin;
    var geometries = this._geometries;
    var propertyKey = this._propertyKey;
    var count = 0;
    var length = 0;
    var animate = function() {
        requestAnimationFrame( animate );

        player.move([
            margin,
            margin,
            width - margin,
            height - margin
        ], keys);

        ball.move([
            margin,
            margin,
            width - margin,
            height - margin
        ]);

        ball.collide(player);
        length = geometries.length;

        geometries.forEach(function(geometry) {
            var feature = geometry.collide(ball);
            if (feature) {
                count++;
                var label = feature.properties && feature.properties[propertyKey] || '';
                text.innerHTML = label;
                counter.innerHTML = count + ' of ' + length;
            }
        });

        if (length === count) {
            text.innerHTML = 'You Win';
        } else if (ball._stop) {
            text.innerHTML = 'Game Over';
        }

    };
    animate();
}

window.MapBreaker = MapBreaker;
