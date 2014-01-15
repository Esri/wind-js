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
      this._connects.push(connect.connect(this, "onOpacityChange", this, this._opacityChangeHandler));
      this._connects.push(connect.connect(this, "onElevationChange",this,this._elevationChangeHandler));
      
      // Initial rendering
      this._drawRasterData();
      
      return element;
    },
    
    _unsetMap: function(map, container) {
      arrayUtils.forEach(this._connects, connect.disconnect, this);
      if (this._element) {
        container.removeChild(this._element);
      }
      this._map = this._element = this._context = this.data = this._connects = null;
    },
    setOpacity: function(o) {
      if (this.opacity != o) {
        this.onOpacityChange(this.opacity = o);
      }
    },
    setElevation: function(el) {
      var curElev = number.round(el,0);
      if (this.elevation !== curElev) {
        this.onElevationChange(this.elevation = curElev);
      }
    },    
    // TODO
    // Move to esri.layers.Layer API
    onElevationChange: function(){},
    onOpacityChange: function() {},
    
    /*****************
     * Public Methods
     *****************/
    
    setData: function(data) {
      this.data = data;

      if (!this._canDraw()) {
        return;
      }

      this.refresh();
    },
    
    refresh: function() {
      if (!this._canDraw()) {
        return;
      }

      this._drawRasterData();
    },
    
    clear: function() {
      if (!this._canDraw()) {
        return;
      }

      this._context.clearRect(0, 0, this._mapWidth, this._mapHeight);
    },
    
    getRange: function() {
      var data = this.data;
      if (!data) {
        return;
      }
      
      var dataArray = data.data, noDataValue = data.noDataValue[0];
      
      var i = 0;
      while (dataArray[i++] === noDataValue);
      
      var maxValue = dataArray[i - 1], minValue = dataArray[i - 1];
      for (; i < dataArray.length; i++) {
        var val = dataArray[i];
        if (val === noDataValue) {
          continue;
        }
        
        if (val > maxValue) {
          maxValue = val;
        }
        if (val < minValue) {
          minValue = val;
        }
      }
      
      return { min: minValue, max: maxValue };
    },
    
    getDatasetRange: function() {
      var data = this.data;
      if (!data) {
        return;
      }
      
      var rasterProps = data.rasterProperties;
      if (rasterProps) {
        return { min: rasterProps.datasetMin, max: rasterProps.datasetMax };
      }
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
    
    _elevationChangeHandler: function(elevation){
        this.clear();
        this._drawRasterData();
    },
    
    _extentChangeHandler: function(extent, delta, levelChange, lod) {
      if (!levelChange) {
        domStyle.set(this._element, { left: "0px", top: "0px" });
        this.clear();
      }
      
      this._drawRasterData();
    },
    
    _drawRasterData: function() {
      if (!this.data) {
        this.clear();
        return;
      }

      var data = this.data, noDataValue = data.noDataValue[0], dataArray = data.data;
      if(!data){return;}
      var numColumns = data.nCols, numRows = data.nRows, size = data.cellSize;

      // Statistics
      var range = this.getDatasetRange() || this.getRange();
      var minValue = range.min, maxValue = range.max;

      var map = this._map;
      var lowerLeftCorner = new Point(data.xLLCenter - (size / 2), data.yLLCenter - (size / 2),new SpatialReference({ wkid: 102100 }));
      var topLeftCorner = lowerLeftCorner.offset(0, numRows * size);
      var bottomRightCorner = lowerLeftCorner.offset(numColumns * size, 0);
      topLeftCorner = map.toScreen(topLeftCorner);
      bottomRightCorner = map.toScreen(bottomRightCorner);
   
      var dataWidth = bottomRightCorner.x - topLeftCorner.x;
      var dataHeight = bottomRightCorner.y - topLeftCorner.y;
  
      var cellWidth = number.round(dataWidth / numColumns), cellHeight = number.round(dataHeight / numRows); 
     
      // Create color functions
      var posFunc = (maxValue > 0) ? this._getCFForPositiveValues(minValue, maxValue) : null;
      var negFunc = (minValue < 0) ? this._getCFForNegativeValues(minValue, maxValue) : null;
      
      var getShade = function(val) {
        if (val >= 0) {
          return posFunc(val);
        }
        else {
          return negFunc(val);
        }
      };
      
      // Draw      
      var top = topLeftCorner.y, ctx = this._context;
      for (var row = 0; row < numRows; row++) {
        var left = topLeftCorner.x;
        for (var col = 0; col < numColumns; col++)  {

          var value = dataArray[(row * numColumns) + col];
          //don't display values that are greater than input elevation
          if (value !== noDataValue && value > this.elevation)  { 
            ctx.fillStyle = getShade(value);
            ctx.fillRect(left, top, cellWidth, cellHeight);
          }
          left += cellWidth;
        }
        top += cellHeight;
      }
    },
    
    _getCFForPositiveValues: function(min, max) {
      if (min < 0) {
        min = 0;
      }
      
      var interval = 255 / (max - min);
      
      return function(val) {
        return "rgb(" + Math.floor((val - min) * interval) + ", 0, 0)";
      };
    },
    
    _getCFForNegativeValues: function(min, max) {
      if (max > 0) {
        max = 0;
      }
      
      var interval = 255 / (max - min);
      
      return function(val) {
        return "rgb(0, 0, " + Math.floor((val - min) * interval) + ")";
      };
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
    },
    
    _opacityChangeHandler: function(value) {
      domStyle.set(this._element, "opacity", value);
    }
  });

  return RL;
});
