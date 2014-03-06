define([
  "dojo/_base/declare", "dojo/_base/connect", "dojo/_base/array",
  "dojo/dom-construct", "dojo/dom-style", "dojo/number",
  "esri/lang", "esri/domUtils", 
  "esri/SpatialReference", "esri/geometry/Point", "esri/layers/layer"
], function(
  declare, connect, arrayUtils,
  domConstruct, domStyle, number,
  esriLang, domUtils, 
  SpatialReference, Point, Layer
) {
  var RL = declare([Layer], {
    // Doc: http://docs.dojocampus.org/dojo/declare#chaining
    "-chains-": {
      constructor: "manual"
    },
    
    constructor: function(data, options) {
      // Manually call superclass constructor with required arguments
      this.inherited(arguments, [ "http://some.server.com/path", options ]);

      this.data = data;

      this.loaded = true;
      this.onLoad(this);
    },
    
    /********************
     * Public Properties
     * 
     * data
     * 
     ********************/
    
    /**********************
     * Internal Properties
     * 
     * _map
     * _element
     * _context
     * _mapWidth
     * _mapHeight
     * _connects
     * 
     **********************/
    
    /******************************
     * esri.layers.Layer Interface
     ******************************/
    
    _setMap: function(map, container) {
      this._map = map;
      
      var element = this._element = domConstruct.create("canvas", {
        id: "canvas",
        width: map.width + "px",
        height: map.height + "px",
        style: "position: absolute; left: 0px; top: 0px;"
      }, container);
      
      if (esriLang.isDefined(this.opacity)) {
        domStyle.set(element, "opacity", this.opacity);
      }
      
      this._context = element.getContext("2d");
      if (!this._context) {
        console.error("This browser does not support <canvas> elements.");
      }
      
      this._mapWidth = map.width;
      this._mapHeight = map.height;
      
      // Event connections
      this._connects = [];
      this._connects.push(connect.connect(map, "onPan", this, this._panHandler));
      this._connects.push(connect.connect(map, "onExtentChange", this, this._extentChangeHandler));
      this._connects.push(connect.connect(map, "onZoomStart", this, this.clear));
      this._connects.push(connect.connect(this, "onVisibilityChange", this, this._visibilityChangeHandler));
      
      return element;
    },
    
    _unsetMap: function(map, container) {
      arrayUtils.forEach(this._connects, connect.disconnect, this);
      if (this._element) {
        container.removeChild(this._element);
      }
      this._map = this._element = this._context = this.data = this._connects = null;
    },
    
    /*****************
     * Public Methods
     *****************/
    
    refresh: function() {
      if (!this._canDraw()) {
        return;
      }
    },
    
    clear: function() {
      if (!this._canDraw()) {
        return;
      }

      this._context.clearRect(0, 0, this._mapWidth, this._mapHeight);
    },
    
    /*******************
     * Internal Methods
     *******************/
    
    _canDraw: function() {
      return (this._map && this._element && this._context) ? true : false; 
    },
    
    _panHandler: function(extent, delta) {
      domStyle.set(this._element, { left: delta.x + "px", top: delta.y + "px" });
    },
    
    _extentChangeHandler: function(extent, delta, levelChange, lod) {
      if (!levelChange) {
        domStyle.set(this._element, { left: "0px", top: "0px" });
        this.clear();
      }
    },
    
    /****************
     * Miscellaneous
     ****************/
    
    _visibilityChangeHandler: function(visible) {
      if (visible) {
        domUtils.show(this._element);
      }
      else { 
        domUtils.hide(this._element);
      }
    }
    
  });

  return RL;
});
