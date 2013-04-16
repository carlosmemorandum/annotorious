goog.provide('annotorious.modules.openlayers.OpenLayersAnnotator');

goog.require('goog.dom');
goog.require('goog.style');

/**
 * The OpenLayersAnnotator is responsible for handling annotation functionality
 * on one OpenLayers map in the page.
 * @param {OpenLayers.Map} map the OpenLayers map
 * @constructor
 */
annotorious.modules.openlayers.OpenLayersAnnotator = function(map) {
  /** @private **/
  this._map = map;
  
  /** @private **/
  this._div = map.div;
  var width = parseInt(goog.style.getComputedStyle(this._div, 'width'));
  var height = parseInt(goog.style.getComputedStyle(this._div, 'height'));
  
  /** @private **/
  this._eventBroker = new annotorious.events.EventBroker();
  
  var annotationLayer = goog.dom.createDom('div', 'annotorious-annotationlayer');
  goog.style.setStyle(annotationLayer, 'position', 'relative');
  goog.style.setSize(annotationLayer, width, height); 
  goog.dom.replaceNode(annotationLayer, this._div);
  goog.dom.appendChild(annotationLayer, this._div); 

  /** @private **/
  var hint = new annotorious.hint.Hint(this, annotationLayer, 'Hold CTRL to Annotate');

  var secondaryHint = goog.soy.renderAsElement(annotorious.templates.openlayers.secondaryHint, {msg: 'Click and Drag'});
  goog.style.setStyle(secondaryHint, 'z-index', 9998);
  goog.style.setOpacity(secondaryHint, 0); 
  goog.dom.appendChild(annotationLayer, secondaryHint);
  
  /** @private **/
  this.popup = new annotorious.viewer.Popup(annotationLayer, this);

  /** @private **/
  this._viewer = new annotorious.modules.openlayers.Viewer(map, this.popup, this);

  /** @private **/
  this._editCanvas = goog.soy.renderAsElement(annotorious.templates.image.canvas, 
    { width:width, height:height });
  goog.style.showElement(this._editCanvas, false);
  goog.style.setStyle(this._editCanvas, 'z-index', 9999);
  goog.dom.appendChild(annotationLayer, this._editCanvas);  

  /** @private **/
  this._selector = new annotorious.plugins.selection.RectDragSelector();
  this._selector.init(this._editCanvas, this); 
    
  /** @private **/
  this.editor = new annotorious.editor.Editor(this, annotationLayer);
  goog.style.setStyle(this.editor.element, 'z-index', 10000);

  var self = this;  
  goog.events.listen(annotationLayer, goog.events.EventType.MOUSEOVER, function(event) {
    var relatedTarget = event.relatedTarget;
    if (!relatedTarget || !goog.dom.contains(annotationLayer, relatedTarget))
      self._eventBroker.fireEvent(annotorious.events.EventType.MOUSE_OVER_ANNOTATABLE_ITEM);
  });
  
  goog.events.listen(annotationLayer, goog.events.EventType.MOUSEOUT, function(event) {
    var relatedTarget = event.relatedTarget;
    if (!relatedTarget || !goog.dom.contains(annotationLayer, relatedTarget))
      self._eventBroker.fireEvent(annotorious.events.EventType.MOUSE_OUT_OF_ANNOTATABLE_ITEM);
  });
  
  goog.events.listen(document, goog.events.EventType.KEYDOWN, function(event) {
    if (event.keyCode == 17) {
      goog.style.setOpacity(secondaryHint, 0.8); 
      goog.style.showElement(self._editCanvas, true);
      window.setTimeout(function() {
        goog.style.setOpacity(secondaryHint, 0);
      }, 2000);
    }
  });
  
  goog.events.listen(this._editCanvas, goog.events.EventType.MOUSEDOWN, function(event) {
    var offset = goog.style.getClientPosition(self._div);
    self._selector.startSelection(event.clientX - offset.x, event.clientY - offset.y);
  });
  
  this._eventBroker.addHandler(annotorious.events.EventType.SELECTION_COMPLETED, function(event) {
    var bounds = event.viewportBounds;
    self.editor.setPosition({ x: bounds.left + self._div.offsetLeft,
                              y: bounds.bottom + 4 + self._div.offsetTop });
    self.editor.open();    
  });

  this._eventBroker.addHandler(annotorious.events.EventType.SELECTION_CANCELED, function(event) {
    self.stopSelection();    
  });
}

/**
 * Standard Annotator method: editAnnotation
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.editAnnotation = function(annotation) {
  // Step 1 - remove from viewer
  this._viewer.removeAnnotation(annotation);

  // Step 2 - TODO find a suitable selector for the shape
  var selector = this._selector;

  // Step 3 - open annotation in editor
  var self = this;
  if (selector) {
    goog.style.showElement(this._editCanvas, true);
    this._viewer.highlightAnnotation(undefined);
    
    // TODO make editable - not just draw (selector implementation required)
    var g2d = this._editCanvas.getContext('2d');
    var shape = annotation.shapes[0];
    var viewportShape = annotorious.shape.transform(shape, function(xy) { return self.fromItemCoordinates(xy); });
    selector.drawShape(g2d, viewportShape);

    var viewportBounds = annotorious.shape.getBoundingRect(viewportShape).geometry;
    this.editor.setPosition({ x: viewportBounds.x + this._div.offsetLeft,
                            y: viewportBounds.y + viewportBounds.height + 4 + this._div.offsetTop });
    this.editor.open(annotation);   
  }
}

/**
 * Standard Annotator method: addAnnotation
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.addAnnotation = function(annotation) {
  this._viewer.addAnnotation(annotation);
}

/**
 * Standard Annotator method: addHandler
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.addHandler = function(type, handler) {
  this._eventBroker.addHandler(type, handler);  
}

/**
 * Standard Annotator method: addSelector
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.addSelector = function(selector) {

}

/**
 * Standard Annotator method: fireEvent
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.fireEvent = function(type, event) {
  this._eventBroker.fireEvent(type, event);
}

/**
 * Standard Annotator method: fromItemCoordinates
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.fromItemCoordinates = function(itemCoords) {
  var pxCoords = this._map.getViewPortPxFromLonLat(new OpenLayers.LonLat(itemCoords.x, itemCoords.y));
  return { x: pxCoords.x, y: pxCoords.y };
}

/**
 * Standard Annotator method: getActiveSelector
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.getActiveSelector = function() {
  return this._selector;
}

/**
 * Standard Annotator method: getAnnotations
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.getAnnotations = function() {

}

/**
 * Standard Annotator method: getAvailableSelectors
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.getAvailableSelectors = function() {

}

/**
 * Standard Annotator method: getItem
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.getItem = function() {
  // TODO implement something decent!
  return {src: "map://openlayers/something"};
}

/**
 * Standard Annotator method: highlightAnnotation
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.highlightAnnotation = function(annotation) {
  this._viewer.highlightAnnotation(annotation);
}

/**
 * Standard Annotator method: removeAnnotation
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.removeAnnotation = function(annotation) {
  this._viewer.removeAnnotation(annotation);
}

/**
 * Standard Annotator method: removeHandler
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.removeHandler = function(type, handler) {
  this._eventBroker.removeHandler(type, handler);
}

/**
 * Standard Annotator method: setActiveSelector
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.setActiveSelector = function(selector) {

}

/**
 * Standard Annotator method: setSelectionEnabled
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.setSelectionEnabled = function(enabled) {

}

/**
 * Standard Annotator method: stopSelection
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.stopSelection = function(original_annotation) {
   goog.style.showElement(this._editCanvas, false);
   this._selector.stopSelection();
   
   // If this was an edit of an annotation (rather than creation of a new one) re-add to viewer!
   if (original_annotation)
     this._viewer.addAnnotation(original_annotation);
}

/**
 * Standard Annotator method: toItemCoordinates
 */
annotorious.modules.openlayers.OpenLayersAnnotator.prototype.toItemCoordinates = function(xy) {
  var itemCoords = this._map.getLonLatFromPixel(new OpenLayers.Pixel(xy.x, xy.y));
  return { x: itemCoords.lon, y: itemCoords.lat };
}
